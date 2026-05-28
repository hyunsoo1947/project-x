'use strict';

const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
});

const requestLog = (req, res, next) => {
    const start = Date.now();
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.requestId);

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        logger.info({
            msg:        'request',
            request_id: req.requestId,
            method:     req.method,
            route:      req.originalUrl,
            status:     res.statusCode,
            duration_ms: durationMs,
            tenant_id:  req.tenant && req.tenant.tenantId,
            user_id:    req.user && req.user.id,
        });
    });

    next();
};

module.exports = { requestLog, logger };
