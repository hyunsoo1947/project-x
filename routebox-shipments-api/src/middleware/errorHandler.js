'use strict';

const { logger } = require('./requestLog');

// Catch-all error handler. Express picks up middleware with arity 4 as
// the error chain. Order matters — mount this LAST.
//
// Returns a sanitized 500 to clients. Full stack goes to logs.
// Specific status codes (400, 404, etc.) are returned by the routes
// themselves; we only land here on uncaught throws.

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
    const status = err.statusCode || 500;
    logger.error({
        msg: 'unhandled_error',
        request_id: req.requestId,
        route: req.originalUrl,
        status,
        err_message: err.message,
        err_stack: err.stack,
    });

    // Don't leak internals in the response.
    const body = {
        error: err.publicCode || 'internal_error',
    };
    if (err.publicMessage) {
        body.message = err.publicMessage;
    }
    res.status(status).json(body);
};

module.exports = { errorHandler };
