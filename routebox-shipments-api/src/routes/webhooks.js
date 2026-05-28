'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const q = require('../db/queries');
const { logger } = require('../middleware/requestLog');

const router = express.Router();

// Webhook receiver for customer integration callbacks. Per-customer
// signature validation is per-provider; we don't model it generically
// here. The `:provider` path parameter is just a label so we can find
// the right rows when a customer asks "did you get our event."
//
// AT-LEAST-ONCE: this endpoint does NOT dedupe. If a customer's system
// retries (timeouts, intentional backfills, etc.), we'll insert the
// event a second time. We've shipped this as "at-least-once semantics"
// to customers and call it intentional. It mostly is. If you change
// this to dedupe, expect support tickets from the customers who have
// built consumers that EXPECT duplicates.

router.post('/:provider', async (req, res, next) => {
    try {
        const provider = req.params.provider;
        const body = req.body || {};
        const shipmentId = parseInt(body.shipment_id || body.shipmentId, 10);

        if (!shipmentId) {
            return res.status(400).json({ error: 'shipment_id_required' });
        }

        // We deliberately do not look up tenant context here — webhooks
        // arrive from third-party systems and are not user-attributable.
        // Tenant scoping happens via the shipment's own tenant_id.
        const { rows: shipRows } = await pool.query(
            'SELECT id, tenant_id, status FROM shipments WHERE id = $1',
            [shipmentId],
        );
        if (shipRows.length === 0) {
            return res.status(404).json({ error: 'shipment_not_found' });
        }

        await pool.query(q.insertShipmentEvent, [
            shipmentId,
            'note_added',
            JSON.stringify({
                provider,
                received_at: new Date().toISOString(),
                payload: body,
            }),
            null,
        ]);

        logger.info({
            msg: 'webhook accepted',
            provider,
            shipment_id: shipmentId,
            request_id: req.requestId,
        });

        // Always 200 even on duplicates. Carriers tend to interpret 4xx as
        // "retry harder" which makes things worse.
        res.json({ ok: true });
    } catch (err) { next(err); }
});

module.exports = router;
