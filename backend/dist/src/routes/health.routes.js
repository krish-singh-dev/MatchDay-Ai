"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// GET /api/v1/health - Returns service health status
router.get('/', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
});
exports.default = router;
