'use strict';

const { pool } = require('../db/pool');
const q = require('../db/queries');
const routeCalc = require('./routeCalcService');
const { logger } = require('../middleware/requestLog');

// Business logic for shipment lifecycle. Most things are async/await; the
// SQS enqueue path is callback-style because routeCalcService still uses
// the v2 SDK callback shape and we never wrapped it. Mixed style is
// intentional-by-neglect; see README "codebase predates the consistency push."

async function createShipment(tenant, input) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: shipRows } = await client.query(q.insertShipment, [
            tenant.tenantId,
            input.account_id || tenant.accountId,
            input.origin_address_id || null,
            input.destination_address_id || null,
            input.weight_kg || null,
            input.status || 'created',
            input.carrier_code || null,
            input.tracking_number || null,
            input.expected_delivery_at || null,
            input.quoted_amount_cents || null,
            input.quoted_currency || null,
            input.customer_notes || null,
            input.internal_notes || null,
            input.metadata ? JSON.stringify(input.metadata) : null,
        ]);
        const shipment = shipRows[0];

        await client.query(q.insertShipmentEvent, [
            shipment.id,
            'created',
            JSON.stringify({ source: 'shipments-api' }),
            null,
        ]);

        await client.query(q.insertShipmentStatusHistory, [
            shipment.id,
            null,
            shipment.status,
            input.created_by_user_id || null,
            input.creation_note || null,
        ]);

        await client.query('COMMIT');

        // Fire-and-forget the SQS publish. If it fails the shipment still
        // exists; the rotate-keys-style backfill job picks up the slack
        // (in theory; in practice we mostly notice a missing route-calc by
        // a customer support ticket and re-enqueue manually).
        routeCalc.enqueueRouteCalc(
            shipment.id, tenant.tenantId, shipment.account_id,
            (err) => {
                if (err) {
                    logger.error({
                        msg: 'route-calc enqueue failed (manual re-enqueue may be needed)',
                        shipment_id: shipment.id,
                        err: err.message,
                    });
                }
            },
        );

        return shipment;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
    } finally {
        client.release();
    }
}

async function getShipment(tenant, shipmentId) {
    const { rows } = await pool.query(q.getShipmentById, [shipmentId, tenant.tenantId]);
    return rows[0] || null;
}

async function updateShipment(tenant, shipmentId, patch) {
    const { rows } = await pool.query(q.updateShipment, [
        shipmentId,
        tenant.tenantId,
        patch.weight_kg ?? null,
        patch.carrier_code ?? null,
        patch.tracking_number ?? null,
        patch.expected_delivery_at ?? null,
        patch.customer_notes ?? null,
        patch.internal_notes ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
    ]);
    return rows[0] || null;
}

async function transitionStatus(tenant, shipmentId, toStatus, opts) {
    opts = opts || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: existing } = await client.query(
            'SELECT status FROM shipments WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [shipmentId, tenant.tenantId],
        );
        if (existing.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        const fromStatus = existing[0].status;
        if (fromStatus === toStatus) {
            await client.query('ROLLBACK');
            return { id: shipmentId, status: fromStatus, unchanged: true };
        }
        const { rows: updated } = await client.query(q.updateShipmentStatus, [
            shipmentId, tenant.tenantId, toStatus,
        ]);
        await client.query(q.insertShipmentStatusHistory, [
            shipmentId,
            fromStatus,
            toStatus,
            opts.changedByUserId || null,
            opts.note || null,
        ]);
        await client.query(q.insertShipmentEvent, [
            shipmentId,
            statusToEventType(toStatus),
            JSON.stringify({ from: fromStatus, to: toStatus }),
            null,
        ]);
        await client.query('COMMIT');
        return updated[0];
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
    } finally {
        client.release();
    }
}

const STATUS_EVENT_MAP = {
    created:           'created',
    label_made:        'label_generated',
    picked_up:         'picked_up',
    in_transit:        'in_transit',
    out_for_delivery:  'out_for_delivery',
    delivered:         'delivered',
    cancelled:         'cancelled',
    returned:          'returned',
    held_at_facility:  'in_transit',
    lost:              'delivery_failed',
    damaged:           'delivery_failed',
};

function statusToEventType(status) {
    return STATUS_EVENT_MAP[status] || 'in_transit';
}

module.exports = {
    createShipment,
    getShipment,
    updateShipment,
    transitionStatus,
    statusToEventType,
};
