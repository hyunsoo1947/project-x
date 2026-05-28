'use strict';

// Test DB helper. Brings the schema up by replaying every Flyway SQL file
// from a sibling clone of routebox-db-migrations against a fresh test DB.
//
// This is what makes the suite slow — applying 48 migrations against a
// real Postgres is ~30s of the suite. We've discussed snapshotting after
// migrate. We haven't.

const fs = require('fs');
const path = require('path');
const pg = require('pg');
const { Pool } = pg;

// In tests, parse bigint as JS number. Real IDs in tests stay small,
// well within MAX_SAFE_INTEGER. This applies process-wide and must run
// before any other module imports pg.Pool.
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const MIGRATIONS_DIR = process.env.ROUTEBOX_MIGRATIONS_DIR
    || path.resolve(__dirname, '../../../routebox-db-migrations/flyway/sql');

function getTestDatabaseUrl() {
    return process.env.TEST_DATABASE_URL
        || 'postgres://postgres:test@localhost:55432/routebox_test';
}

async function applyMigrations(pool) {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        throw new Error(
            `migrations dir not found: ${MIGRATIONS_DIR}. ` +
            'set ROUTEBOX_MIGRATIONS_DIR or clone routebox-db-migrations alongside this repo',
        );
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter((f) => /^V\d+__.*\.sql$/.test(f))
        .sort();
    for (const f of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
        await pool.query(sql);
    }
}

async function setupTestDatabase() {
    const url = getTestDatabaseUrl();
    // Reset schema so each test run starts clean. We DROP SCHEMA public
    // and let the migrations recreate it; faster than dropping and
    // recreating the database.
    const pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await applyMigrations(pool);
    await pool.end();
    process.env.DATABASE_URL = url;
}

async function seedMinimalTenant(pool) {
    const { rows: tenantRows } = await pool.query(
        `INSERT INTO tenants (name, slug) VALUES ($1, $2)
         RETURNING id`,
        ['Test Tenant', `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`],
    );
    const tenantId = tenantRows[0].id;

    const { rows: accountRows } = await pool.query(
        `INSERT INTO accounts (tenant_id, name) VALUES ($1, $2) RETURNING id`,
        [tenantId, 'Test Account'],
    );
    const accountId = accountRows[0].id;

    const { rows: userRows } = await pool.query(
        `INSERT INTO users (tenant_id, account_id, email, role)
         VALUES ($1, $2, $3, 'member') RETURNING id`,
        [tenantId, accountId, `test-${Date.now()}@example.com`],
    );
    const userId = userRows[0].id;

    return { tenantId, accountId, userId };
}

module.exports = {
    getTestDatabaseUrl,
    setupTestDatabase,
    seedMinimalTenant,
    MIGRATIONS_DIR,
};
