"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/v1/density/ingest - Ingest density reading
router.post('/ingest', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['staff', 'admin']), (req, res) => {
    const { zoneId, estimatedCount } = req.body;
    res.status(201).json({
        id: 'mock-reading-id',
        zoneId,
        estimatedCount,
        densityPct: 0.5,
        recordedAt: new Date(),
    });
});
exports.default = router;
