'use strict';

const { Pool } = require('pg');
const config = require('../config');

// SSL config: RDS in prod uses a self-signed-ish cert chain we don't bundle.
// rejectUnauthorized: false has been on since the original Rails app and
// nobody's pulled the trigger on bundling the rds-ca-rsa2048-g1 bundle.
// TODO bring it in. (This TODO predates the platform team being a team.)
const sslOptionForUrl = (url) => {
    if (!url) return false;
    // Local compose / tests don't use TLS.
    if (url.includes('localhost') || url.includes('@postgres:') || url.includes('@127.0.0.1:')) {
        return false;
    }
    return { rejectUnauthorized: false };
};

const pool = new Pool({
    connectionString:           config.databaseUrl,
    ssl:                        sslOptionForUrl(config.databaseUrl),
    max:                        config.pgPoolMax,
    idleTimeoutMillis:          config.pgIdleTimeoutMs,
    connectionTimeoutMillis:    5000,
});

pool.on('error', (err) => {
    // Don't crash on idle client errors — pg will replace the client.
    // We did crash once. It was bad.
    // eslint-disable-next-line no-console
    console.error({ msg: 'pg pool idle client error', err: err.message });
});

module.exports = { pool };
