"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sanitize_middleware_1 = require("../middleware/sanitize.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/v1/chat/query - Submit user chat query
router.post('/query', sanitize_middleware_1.sanitizeInput, (req, res) => {
    const { queryText, venueId, userId } = req.body;
    res.status(200).json({
        id: 'mock-query-id',
        userId: userId || null,
        venueId: venueId || 'mock-venue-id',
        queryText: queryText || '',
        detectedLanguage: 'en',
        responseText: `Stub Response to: "${queryText}"`,
        wasCached: false,
        createdAt: new Date(),
    });
});
// GET /api/v1/chat/history/:userId - Get query history for user
router.get('/history/:userId', auth_middleware_1.requireAuth, (req, res) => {
    const { userId } = req.params;
    res.status(200).json([]);
});
exports.default = router;
