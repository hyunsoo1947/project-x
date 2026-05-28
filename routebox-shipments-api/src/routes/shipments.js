'use strict';

const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');
const shipments = require('../services/shipmentService');

const router = express.Router();

// Every route in here requires a valid JWT and a tenant context.
router.use(requireJwt, tenantContext);

router.post('/', async (req, res, next) => {
    try {
        const body = req.body || {};
        if (!body.account_id && !req.tenant.accountId) {
            return res.status(400).json({ error: 'account_id_required' });
        }
        const created = await shipments.createShipment(req.tenant, {
            ...body,
            created_by_user_id: req.user.id,
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
        const ship = await shipments.getShipment(req.tenant, id);
        if (!ship) return res.status(404).json({ error: 'not_found' });
        res.json(ship);
    } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
        const updated = await shipments.updateShipment(req.tenant, id, req.body || {});
        if (!updated) return res.status(404).json({ error: 'not_found' });
        res.json(updated);
    } catch (err) { next(err); }
});

router.post('/:id/status', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
        const { to_status, note } = req.body || {};
        if (!to_status) return res.status(400).json({ error: 'to_status_required' });
        const result = await shipments.transitionStatus(req.tenant, id, to_status, {
            changedByUserId: req.user.id,
            note,
        });
        if (!result) return res.status(404).json({ error: 'not_found' });
        res.json(result);
    } catch (err) { next(err); }
});

module.exports = router;
