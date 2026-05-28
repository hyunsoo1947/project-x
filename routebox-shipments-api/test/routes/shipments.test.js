'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { setupTestDatabase, seedMinimalTenant, getTestDatabaseUrl } = require('../helpers/db');

const TEST_JWT_KEY = 'test-jwt-key-not-real';

describe('shipments routes', () => {
    let app;
    let pool;
    let tenant;

    beforeAll(async () => {
        process.env.JWT_SIGNING_KEY = TEST_JWT_KEY;
        process.env.DATABASE_URL = getTestDatabaseUrl();
        process.env.LOG_LEVEL = 'error';
        await setupTestDatabase();
        // Require AFTER setupTestDatabase so config picks up DATABASE_URL.
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        tenant = await seedMinimalTenant(pool);
        const { buildApp } = require('../../src/index');
        app = buildApp();
    });

    afterAll(async () => {
        if (pool) await pool.end();
        const { pool: appPool } = require('../../src/db/pool');
        await appPool.end();
    });

    function tokenFor(userId, tenantId, accountId, role) {
        return jwt.sign(
            { sub: String(userId), tenant_id: tenantId, account_id: accountId, role: role || 'member' },
            TEST_JWT_KEY,
            { algorithm: 'HS256', expiresIn: '1h' },
        );
    }

    test('rejects missing bearer token', async () => {
        const res = await request(app).get('/v1/shipments/1');
        expect(res.status).toBe(401);
    });

    test('rejects invalid bearer token', async () => {
        const res = await request(app)
            .get('/v1/shipments/1')
            .set('Authorization', 'Bearer not-a-real-token');
        expect(res.status).toBe(401);
    });

    test('returns 404 for unknown shipment', async () => {
        const token = tokenFor(tenant.userId, tenant.tenantId, tenant.accountId);
        const res = await request(app)
            .get('/v1/shipments/9999999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    test('creates a shipment', async () => {
        const token = tokenFor(tenant.userId, tenant.tenantId, tenant.accountId);
        const res = await request(app)
            .post('/v1/shipments')
            .set('Authorization', `Bearer ${token}`)
            .send({
                weight_kg: 1.234,
                carrier_code: 'UPS',
                tracking_number: 'TEST-001',
            });
        expect(res.status).toBe(201);
        expect(res.body.id).toBeGreaterThan(0);
        expect(res.body.tenant_id).toBe(tenant.tenantId);
        expect(res.body.status).toBe('created');
    });

    test('round-trips a shipment via GET', async () => {
        const token = tokenFor(tenant.userId, tenant.tenantId, tenant.accountId);
        const created = await request(app)
            .post('/v1/shipments')
            .set('Authorization', `Bearer ${token}`)
            .send({ weight_kg: 2.5, carrier_code: 'FDX' });
        expect(created.status).toBe(201);

        const got = await request(app)
            .get(`/v1/shipments/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(got.status).toBe(200);
        expect(got.body.id).toBe(created.body.id);
        expect(got.body.carrier_code).toBe('FDX');
    });

    test('PATCH updates fields', async () => {
        const token = tokenFor(tenant.userId, tenant.tenantId, tenant.accountId);
        const created = await request(app)
            .post('/v1/shipments')
            .set('Authorization', `Bearer ${token}`)
            .send({ weight_kg: 3.3 });
        const patched = await request(app)
            .patch(`/v1/shipments/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ tracking_number: 'NEW-TRK' });
        expect(patched.status).toBe(200);

        const got = await request(app)
            .get(`/v1/shipments/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(got.body.tracking_number).toBe('NEW-TRK');
    });

    test('status transition writes shipment_status_history', async () => {
        const token = tokenFor(tenant.userId, tenant.tenantId, tenant.accountId);
        const created = await request(app)
            .post('/v1/shipments')
            .set('Authorization', `Bearer ${token}`)
            .send({ weight_kg: 4.1 });
        const transitioned = await request(app)
            .post(`/v1/shipments/${created.body.id}/status`)
            .set('Authorization', `Bearer ${token}`)
            .send({ to_status: 'picked_up', note: 'driver scanned' });
        expect(transitioned.status).toBe(200);
        expect(transitioned.body.status).toBe('picked_up');

        const { rows } = await pool.query(
            'SELECT from_status, to_status, note FROM shipment_status_history WHERE shipment_id = $1 ORDER BY id',
            [created.body.id],
        );
        // V001 status_history entry on create + V001 transition on this call
        expect(rows.length).toBeGreaterThanOrEqual(2);
        const last = rows[rows.length - 1];
        expect(last.from_status).toBe('created');
        expect(last.to_status).toBe('picked_up');
        expect(last.note).toBe('driver scanned');
    });
});
