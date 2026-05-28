'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const q = require('../db/queries');

const router = express.Router();

// /healthz — process is up. No external dependencies.
router.get('/healthz', (req, res) => {
    res.json({ ok: true });
});

// /readyz — DB pool can reach Postgres. Hits the DB on every call.
// We don't cache the result. If readyz is hot enough that this is a
// problem, that's a sign of an upstream-of-us issue.
router.get('/readyz', async (req, res) => {
    try {
        const { rows } = await pool.query(q.readyzPing);
        if (rows[0] && rows[0].ok === 1) {
            return res.json({ ok: true });
        }
        return res.status(503).json({ ok: false, reason: 'unexpected_db_response' });
    } catch (err) {
        return res.status(503).json({ ok: false, reason: 'db_unreachable', detail: err.message });
    }
});

module.exports = router;
