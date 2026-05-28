'use strict';

// Tenant scoping. Every authenticated request gets a req.tenant populated
// from the JWT's tenant_id claim. Downstream queries do `WHERE tenant_id = $1`.
//
// There is NO Postgres-level row-level security. We discussed turning on
// RLS at the schema level. We decided "later" and never came back. The
// safety net here is purely application-level — if a query in this codebase
// forgets to scope by tenant_id, that query leaks across tenants.
//
// This is documented in routebox-db-migrations/docs/schema-ownership.md.
// This middleware is part of the social contract, not an enforcement layer.

const tenantContext = (req, res, next) => {
    if (!req.user || !req.user.tenantId) {
        return res.status(403).json({ error: 'no_tenant_context' });
    }
    req.tenant = {
        tenantId:  req.user.tenantId,
        accountId: req.user.accountId,
    };
    next();
};

module.exports = { tenantContext };
