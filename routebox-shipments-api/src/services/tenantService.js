'use strict';

const { pool } = require('../db/pool');

// Tenant + account lookup helpers. The JWT carries tenant_id and account_id
// as claims; these helpers exist for handlers that need the full record
// (e.g. branding for shipment receipts).

async function getTenantById(tenantId) {
    const { rows } = await pool.query(
        'SELECT id, name, slug, billing_plan, status FROM tenants WHERE id = $1',
        [tenantId],
    );
    return rows[0] || null;
}

async function getAccountForTenant(tenantId, accountId) {
    const { rows } = await pool.query(
        `SELECT id, tenant_id, name, status, billing_address_id,
                branding_logo_url, branding_color_hex
         FROM accounts WHERE id = $1 AND tenant_id = $2`,
        [accountId, tenantId],
    );
    return rows[0] || null;
}

module.exports = { getTenantById, getAccountForTenant };
