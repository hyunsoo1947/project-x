'use strict';

// Named SQL queries. Plain strings, not a query builder — we evaluated
// knex once. The build size doubled. We took it out.
//
// Column names track routebox-db-migrations/flyway/sql/V001 forward.
// If a column changes name (e.g. V025 renamed shipments.notes ->
// customer_notes), update here.

const insertShipment = `
    INSERT INTO shipments (
        tenant_id, account_id,
        origin_address_id, destination_address_id,
        weight_kg,
        status,
        carrier_code, tracking_number,
        expected_delivery_at,
        quoted_amount_cents, quoted_currency,
        customer_notes, internal_notes,
        metadata
    ) VALUES (
        $1, $2,
        $3, $4,
        $5,
        COALESCE($6, 'created'),
        $7, $8,
        $9,
        $10, $11,
        $12, $13,
        COALESCE($14, '{}'::jsonb)
    )
    RETURNING id, tenant_id, account_id, status, created_at
`;

const getShipmentById = `
    SELECT
        s.id, s.tenant_id, s.account_id,
        s.origin_address_id, s.destination_address_id,
        s.weight_kg, s.status, s.carrier_code, s.tracking_number,
        s.expected_delivery_at, s.delivered_at,
        s.quoted_amount_cents, s.quoted_currency,
        s.customer_notes, s.internal_notes,
        s.label_url, s.label_generated_at,
        s.metadata,
        s.created_at, s.updated_at,
        st.description AS status_description,
        st.terminal AS status_terminal
    FROM shipments s
    LEFT JOIN shipment_status_types st ON st.code = s.status
    WHERE s.id = $1 AND s.tenant_id = $2
`;

const updateShipment = `
    UPDATE shipments SET
        weight_kg            = COALESCE($3,  weight_kg),
        carrier_code         = COALESCE($4,  carrier_code),
        tracking_number      = COALESCE($5,  tracking_number),
        expected_delivery_at = COALESCE($6,  expected_delivery_at),
        customer_notes       = COALESCE($7,  customer_notes),
        internal_notes       = COALESCE($8,  internal_notes),
        metadata             = COALESCE($9,  metadata),
        updated_at           = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING id, status, updated_at
`;

const updateShipmentStatus = `
    UPDATE shipments SET
        status = $3::varchar,
        delivered_at = CASE WHEN $3::varchar = 'delivered' THEN NOW() ELSE delivered_at END,
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING id, status
`;

const insertShipmentEvent = `
    INSERT INTO shipment_events (shipment_id, event_type, payload, occurred_at)
    VALUES ($1, $2, COALESCE($3, '{}'::jsonb), COALESCE($4, NOW()))
    RETURNING id, recorded_at
`;

const insertShipmentStatusHistory = `
    INSERT INTO shipment_status_history (
        shipment_id, from_status, to_status, changed_by_user_id, note
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id, changed_at
`;

const findUserById = `
    SELECT id, tenant_id, account_id, email, role, status
    FROM users
    WHERE id = $1
`;

const findApiTokenByDigest = `
    SELECT id, name, scopes, revoked_at
    FROM api_tokens
    WHERE token_digest = $1
`;

// Used by /internal/legacy-export. Cursor-iterated. Don't add a LIMIT —
// the data team wants the whole table per nightly run.
const legacyExportSelect = `
    SELECT
        s.id              AS shipment_id,
        s.tenant_id,
        a.name            AS account_name,
        s.status,
        st.description    AS status_description,
        s.carrier_code,
        s.tracking_number,
        s.expected_delivery_at,
        s.delivered_at,
        s.quoted_amount_cents,
        s.quoted_currency,
        s.created_at,
        s.updated_at
    FROM shipments s
    LEFT JOIN accounts a              ON a.id = s.account_id
    LEFT JOIN shipment_status_types st ON st.code = s.status
    ORDER BY s.id
`;

const insertLegacyExportRun = `
    INSERT INTO legacy_export_runs (triggered_by, status)
    VALUES ($1, 'started')
    RETURNING id, run_started_at
`;

const finishLegacyExportRun = `
    UPDATE legacy_export_runs SET
        run_completed_at = NOW(),
        rows_exported    = $2,
        status           = $3,
        error            = $4
    WHERE id = $1
`;

const readyzPing = 'SELECT 1 AS ok';

module.exports = {
    insertShipment,
    getShipmentById,
    updateShipment,
    updateShipmentStatus,
    insertShipmentEvent,
    insertShipmentStatusHistory,
    findUserById,
    findApiTokenByDigest,
    legacyExportSelect,
    insertLegacyExportRun,
    finishLegacyExportRun,
    readyzPing,
};
