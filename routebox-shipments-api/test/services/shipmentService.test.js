'use strict';

const { setupTestDatabase, seedMinimalTenant, getTestDatabaseUrl } = require('../helpers/db');

describe('shipmentService', () => {
    let pool;
    let tenant;
    let shipmentService;

    beforeAll(async () => {
        process.env.DATABASE_URL = getTestDatabaseUrl();
        process.env.LOG_LEVEL = 'error';
        await setupTestDatabase();
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        tenant = await seedMinimalTenant(pool);
        shipmentService = require('../../src/services/shipmentService');
    });

    afterAll(async () => {
        if (pool) await pool.end();
        const { pool: appPool } = require('../../src/db/pool');
        await appPool.end();
    });

    test('createShipment writes shipment + event + status_history rows', async () => {
        const ctx = { tenantId: tenant.tenantId, accountId: tenant.accountId };
        const shipment = await shipmentService.createShipment(ctx, {
            weight_kg: 5,
            carrier_code: 'USPS',
            created_by_user_id: tenant.userId,
        });
        expect(shipment.id).toBeGreaterThan(0);

        const events = await pool.query(
            'SELECT event_type FROM shipment_events WHERE shipment_id = $1',
            [shipment.id],
        );
        expect(events.rows.map((r) => r.event_type)).toContain('created');

        const history = await pool.query(
            'SELECT from_status, to_status FROM shipment_status_history WHERE shipment_id = $1',
            [shipment.id],
        );
        expect(history.rows.length).toBe(1);
        expect(history.rows[0].to_status).toBe('created');
    });

    test('transitionStatus is a no-op for same-status', async () => {
        const ctx = { tenantId: tenant.tenantId, accountId: tenant.accountId };
        const shipment = await shipmentService.createShipment(ctx, {
            weight_kg: 1,
            created_by_user_id: tenant.userId,
        });
        const result = await shipmentService.transitionStatus(ctx, shipment.id, 'created', {});
        expect(result.unchanged).toBe(true);
    });

    test('statusToEventType maps known states', () => {
        expect(shipmentService.statusToEventType('delivered')).toBe('delivered');
        expect(shipmentService.statusToEventType('lost')).toBe('delivery_failed');
        expect(shipmentService.statusToEventType('totally-made-up')).toBe('in_transit');
    });
});
