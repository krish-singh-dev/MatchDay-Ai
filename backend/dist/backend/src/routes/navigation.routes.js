"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stadiumGraph_1 = require("../config/stadiumGraph");
const router = (0, express_1.Router)();
// GET /api/v1/navigation/zones - Lists all zones with names and coordinates
router.get('/zones', (req, res) => {
    res.status(200).json(stadiumGraph_1.STADIUM_ZONES);
});
// POST /api/v1/navigation/route - Runs the pathfinding solver between start and end zones
router.post('/route', (req, res) => {
    const { startZoneId, endZoneId } = req.body;
    if (!startZoneId || !endZoneId) {
        res.status(400).json({ error: 'Missing startZoneId or endZoneId parameters' });
        return;
    }
    const result = (0, stadiumGraph_1.findRoute)(startZoneId, endZoneId);
    if (!result) {
        res.status(404).json({ error: 'No route found between the selected zones' });
        return;
    }
    res.status(200).json(result);
});
exports.default = router;
