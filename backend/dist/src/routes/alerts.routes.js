"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Apply auth to all alerts endpoints
router.use(auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['staff', 'admin']));
// GET /api/v1/alerts/active/:venueId - List active alerts
router.get('/active/:venueId', (req, res) => {
    const { venueId } = req.params;
    res.status(200).json([]);
});
// POST /api/v1/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/:alertId/acknowledge', (req, res) => {
    const { alertId } = req.params;
    res.status(200).json({
        id: alertId,
        acknowledgedBy: 'mock-staff-user-id',
        resolvedAt: null,
    });
});
// POST /api/v1/alerts/:alertId/resolve - Resolve alert
router.post('/:alertId/resolve', (req, res) => {
    const { alertId } = req.params;
    res.status(200).json({
        id: alertId,
        resolvedAt: new Date(),
    });
});
// GET /api/v1/alerts/:alertId/recommendation - Fetch AI mitigation recommendation
router.get('/:alertId/recommendation', (req, res) => {
    const { alertId } = req.params;
    res.status(200).json({
        alertId,
        recommendation: 'Stub AI recommendation: Reroute traffic to alternative gate.',
    });
});
exports.default = router;
