'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const { pool } = require('./db/pool');
const { requestLog, logger } = require('./middleware/requestLog');
const { errorHandler } = require('./middleware/errorHandler');

const healthRouter    = require('./routes/health');
const shipmentsRouter = require('./routes/shipments');
const webhooksRouter  = require('./routes/webhooks');
const internalRouter  = require('./routes/internal');

function buildApp() {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', true); // ALB sits in front

    // body-parser. Webhooks have a higher limit because one carrier sends
    // 8MB blobs and 100kb is the default. Don't normalize. Raw comment 2.
    app.use('/v1/webhooks', bodyParser.json({ limit: config.webhookBodyLimit }));
    app.use(bodyParser.json({ limit: '1mb' }));

    app.use(requestLog);

    // Routes that don't require auth.
    app.use('/', healthRouter);
    app.use('/internal', internalRouter);

    // Authenticated routes.
    app.use('/v1/shipments', shipmentsRouter);
    app.use('/v1/webhooks',  webhooksRouter);

    // Default 404 (matches no route).
    app.use((req, res) => {
        res.status(404).json({ error: 'not_found' });
    });

    app.use(errorHandler);

    return app;
}

function startServer() {
    const app = buildApp();
    const server = app.listen(config.port, () => {
        logger.info({ msg: 'shipments-api listening', port: config.port, env: config.env });
    });

    const shutdown = (signal) => {
        logger.info({ msg: 'shutdown signal received', signal });
        // Stop accepting new connections, drain in-flight, close pool.
        server.close((err) => {
            if (err) {
                logger.error({ msg: 'http server close error', err: err.message });
            }
            pool.end()
                .then(() => {
                    logger.info({ msg: 'pg pool drained, exiting' });
                    process.exit(0);
                })
                .catch((poolErr) => {
                    logger.error({ msg: 'pg pool drain error', err: poolErr.message });
                    process.exit(1);
                });
        });
        // Hard timeout in case something hangs.
        setTimeout(() => {
            logger.error({ msg: 'shutdown timeout, forcing exit' });
            process.exit(1);
        }, 15000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    return server;
}

module.exports = { buildApp, startServer };

if (require.main === module) {
    startServer();
}
