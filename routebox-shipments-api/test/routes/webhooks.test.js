'use strict';

const request = require('supertest');
const { setupTestDatabase, seedMinimalTenant, getTestDatabaseUrl } = require('../helpers/db');

describe('webhook routes', () => {
    let app;
    let pool;
    let tenant;
    let shipmentId;

    beforeAll(async () => {
        process.env.JWT_SIGNING_KEY = 'test-jwt-key-not-real';
        process.env.DATABASE_URL = getTestDatabaseUrl();
        process.env.LOG_LEVEL = 'error';
        await setupTestDatabase();
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        tenant = await seedMinimalTenant(pool);
        const { rows } = await pool.query(
            `INSERT INTO shipments (tenant_id, account_id, status)
             VALUES ($1, $2, 'created') RETURNING id`,
            [tenant.tenantId, tenant.accountId],
        );
        shipmentId = rows[0].id;
        const { buildApp } = require('../../src/index');
        app = buildApp();
    });

    afterAll(async () => {
        if (pool) await pool.end();
        const { pool: appPool } = require('../../src/db/pool');
        await appPool.end();
    });

    test('rejects missing shipment_id', async () => {
        const res = await request(app)
            .post('/v1/webhooks/ups')
            .send({ status: 'in_transit' });
        expect(res.status).toBe(400);
    });

    test('returns 404 for unknown shipment', async () => {
        const res = await request(app)
            .post('/v1/webhooks/ups')
            .send({ shipment_id: 9999999, status: 'in_transit' });
        expect(res.status).toBe(404);
    });

    test('does NOT dedupe — at-least-once is the contract', async () => {
        const before = await pool.query(
            'SELECT count(*)::int AS n FROM shipment_events WHERE shipment_id = $1',
            [shipmentId],
        );
        const beforeN = before.rows[0].n;

        const body = { shipment_id: shipmentId, status: 'in_transit', external_id: 'ABC123' };
        const r1 = await request(app).post('/v1/webhooks/ups').send(body);
        const r2 = await request(app).post('/v1/webhooks/ups').send(body);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);

        const after = await pool.query(
            'SELECT count(*)::int AS n FROM shipment_events WHERE shipment_id = $1',
            [shipmentId],
        );
        expect(after.rows[0].n).toBe(beforeN + 2);
    });
});
