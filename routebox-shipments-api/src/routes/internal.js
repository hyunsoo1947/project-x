'use strict';

// /internal/legacy-export
//
// The data team's nightly warehouse sync hits this. CSV-streamed dump of
// the shipments table joined with accounts and shipment_status_types.
// Bypasses the normal request validation. Unauthenticated within the VPC.
//
// IF YOU ARE LOOKING AT THIS WONDERING WHY IT EXISTS:
//   - It's been here since the data team's pipeline first stood up.
//   - It is not in the public API docs because it is not really supported.
//   - The ALB security group restricts it to in-VPC traffic. The endpoint
//     itself does NOT enforce auth. This is an open finding.
//   - The data team's Slack channel is #data-platform. Talk to them
//     before changing or removing it. The last attempt to clean it up
//     broke the warehouse sync for two days.
//   - See routebox-platform-docs/notes/handover.md "shipments-api" section.
//
// We have talked about putting this behind an internal-only auth path.
// We have not done it. — Jonathan, who is no longer here

const express = require('express');
const { stringify } = require('csv-stringify');

// pg-cursor is an optional dep — historically wasn't installed in some
// envs. The in-memory fallback below has been load-bearing for years.
let Cursor = null;
try {
    Cursor = require('pg-cursor');
} catch (_) {
    // optional, intentional
}

const { pool } = require('../db/pool');
const config = require('../config');
const q = require('../db/queries');
const { logger } = require('../middleware/requestLog');

const router = express.Router();

const CSV_COLUMNS = [
    'shipment_id',
    'tenant_id',
    'account_name',
    'status',
    'status_description',
    'carrier_code',
    'tracking_number',
    'expected_delivery_at',
    'delivered_at',
    'quoted_amount_cents',
    'quoted_currency',
    'created_at',
    'updated_at',
];

router.get('/legacy-export', async (req, res, next) => {
    if (!config.legacyExportEnabled) {
        // We've never flipped this off in any env. The flag exists only so
        // we have a fast switch if the endpoint melts something.
        return res.status(503).json({ error: 'legacy_export_disabled' });
    }

    const triggeredBy = req.headers['x-triggered-by'] || 'data-team-warehouse-sync';

    let runId = null;
    try {
        const { rows } = await pool.query(q.insertLegacyExportRun, [triggeredBy]);
        runId = rows[0].id;
    } catch (err) {
        // If we can't even write the run-tracker row we don't try to stream
        // — surface it as a 500 so the data team's pipeline retries.
        return next(err);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shipments-export.csv"');

    const csv = stringify({ header: true, columns: CSV_COLUMNS });
    csv.pipe(res);

    let rowCount = 0;
    let runError = null;

    // Server-side cursor via pg-cursor when available; fall back to a
    // single in-memory query if the import is missing (it's an optional
    // dep — historically it wasn't installed in some envs and the fall-
    // back has been load-bearing for years).
    if (Cursor) {
        const client = await pool.connect();
        let cursor;
        try {
            cursor = client.query(new Cursor(q.legacyExportSelect));
            await streamCursor(cursor, csv, (n) => { rowCount = n; });
        } catch (err) {
            runError = err.message;
            logger.error({ msg: 'legacy-export cursor error', err: err.message });
        } finally {
            try { if (cursor) await cursor.close(); } catch (_) {}
            client.release();
            csv.end();
        }
    } else {
        try {
            const { rows } = await pool.query(q.legacyExportSelect);
            for (const row of rows) {
                csv.write(row);
                rowCount++;
            }
        } catch (err) {
            runError = err.message;
            logger.error({ msg: 'legacy-export query error', err: err.message });
        } finally {
            csv.end();
        }
    }

    // Mark the run completed. Best-effort — if this fails we just don't
    // see the row.
    try {
        await pool.query(q.finishLegacyExportRun, [
            runId,
            rowCount,
            runError ? 'failed' : 'ok',
            runError,
        ]);
    } catch (err) {
        logger.error({ msg: 'legacy-export finalize failed', err: err.message });
    }
});

function streamCursor(cursor, sink, onProgress) {
    return new Promise((resolve, reject) => {
        let total = 0;
        const next = () => {
            cursor.read(500, (err, rows) => {
                if (err) return reject(err);
                if (rows.length === 0) {
                    onProgress(total);
                    return resolve();
                }
                for (const r of rows) sink.write(r);
                total += rows.length;
                onProgress(total);
                next();
            });
        };
        next();
    });
}

module.exports = router;
