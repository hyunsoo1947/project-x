'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { logger } = require('./requestLog');

// JWT validation. We verify HS256 against JWT_SIGNING_KEY (same key the
// ops-console Rails app signs with — that's the social contract). If the
// signing key rotates, both services need to redeploy. The key lives in
// Secrets Manager at routebox/<env>/JWT_SIGNING_KEY.
//
// /internal/* and /healthz/readyz routes mount this BEFORE this middleware
// so they don't require a token.

const requireJwt = (req, res, next) => {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return res.status(401).json({ error: 'missing_bearer_token' });
    }
    const token = m[1];

    if (!config.jwtSigningKey) {
        logger.error({ msg: 'auth: JWT_SIGNING_KEY not configured' });
        return res.status(500).json({ error: 'server_misconfigured' });
    }

    let claims;
    try {
        claims = jwt.verify(token, config.jwtSigningKey, { algorithms: ['HS256'] });
    } catch (err) {
        return res.status(401).json({ error: 'invalid_token', detail: err.message });
    }

    req.user = {
        id:        claims.sub ? parseInt(claims.sub, 10) : null,
        email:     claims.email,
        role:      claims.role,
        accountId: claims.account_id ? parseInt(claims.account_id, 10) : null,
        tenantId:  claims.tenant_id  ? parseInt(claims.tenant_id, 10)  : null,
        raw:       claims,
    };
    next();
};

// Internal service-to-service auth via the shared INTERNAL_API_TOKEN. Used
// on a small number of routes that other services call (e.g., ops-console
// asking for shipment data on behalf of a user it's already authenticated).
const requireInternalToken = (req, res, next) => {
    const provided = req.headers['x-internal-token'];
    if (!provided || !config.internalApiToken || provided !== config.internalApiToken) {
        return res.status(401).json({ error: 'invalid_internal_token' });
    }
    next();
};

module.exports = { requireJwt, requireInternalToken };
