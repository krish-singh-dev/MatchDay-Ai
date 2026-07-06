"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_client_1 = require("../config/db.client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const geminiClient_1 = require("../ai/geminiClient");
const events_1 = require("../socket/events");
const router = (0, express_1.Router)();
// Apply auth and staff/admin role gate to all alert endpoints
router.use(auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['staff', 'admin']));
// GET /api/v1/alerts/active/:venueId - Fetch active (unresolved) alerts for a venue
router.get('/active/:venueId', async (req, res) => {
    try {
        const { venueId } = req.params;
        const activeAlerts = await db_client_1.prisma.alert.findMany({
            where: {
                resolvedAt: null,
                zone: {
                    venueId,
                },
            },
            include: {
                zone: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.status(200).json(activeAlerts);
    }
    catch (error) {
        console.error('Error fetching active alerts:', error);
        res.status(500).json({ error: 'Failed to fetch active alerts' });
    }
});
// POST /api/v1/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User context not found' });
            return;
        }
        const updatedAlert = await db_client_1.prisma.alert.update({
            where: { id: alertId },
            data: {
                acknowledgedBy: userId,
            },
            include: {
                zone: true,
            },
        });
        res.status(200).json(updatedAlert);
    }
    catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});
// POST /api/v1/alerts/:alertId/resolve - Resolve alert
router.post('/:alertId/resolve', async (req, res) => {
    try {
        const { alertId } = req.params;
        const resolvedAlert = await db_client_1.prisma.alert.update({
            where: { id: alertId },
            data: {
                resolvedAt: new Date(),
            },
            include: {
                zone: true,
            },
        });
        // Emit live alert:resolved event via Socket.IO
        (0, events_1.emitAlertResolved)(resolvedAlert);
        res.status(200).json(resolvedAlert);
    }
    catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
});
// GET /api/v1/alerts/:alertId/recommendation - Fetch AI-generated crowd rerouting mitigation recommendation
router.get('/:alertId/recommendation', async (req, res) => {
    try {
        const { alertId } = req.params;
        // 1. Fetch the alert and its associated zone
        const alert = await db_client_1.prisma.alert.findUnique({
            where: { id: alertId },
            include: {
                zone: true,
            },
        });
        if (!alert) {
            res.status(404).json({ error: 'Alert not found' });
            return;
        }
        // If recommendation has already been custom generated, we can check.
        // For v1 operations, we compile dynamic crowd statistics and call Gemini on-demand to fetch fresh mitigation plans.
        // 2. Fetch latest density reading for the alert zone
        const targetReading = await db_client_1.prisma.densityReading.findFirst({
            where: { zoneId: alert.zoneId },
            orderBy: { recordedAt: 'desc' },
        });
        const targetPct = targetReading ? Math.round(parseFloat(targetReading.densityPct.toString()) * 100) : 100;
        const targetCount = targetReading ? targetReading.estimatedCount : alert.zone.maxCapacity;
        // 3. Fetch all other zones in the venue with their latest density readings to find alternative rerouting paths
        const otherZones = await db_client_1.prisma.zone.findMany({
            where: {
                venueId: alert.zone.venueId,
                NOT: { id: alert.zoneId },
            },
            include: {
                densityReadings: {
                    orderBy: { recordedAt: 'desc' },
                    take: 1,
                },
            },
        });
        let adjacentStatsText = '';
        otherZones.forEach((z) => {
            const reading = z.densityReadings[0];
            const pct = reading ? Math.round(parseFloat(reading.densityPct.toString()) * 100) : 0;
            adjacentStatsText += `- "${z.name}" (${z.zoneType}): currently at ${pct}% capacity (${reading?.estimatedCount || 0}/${z.maxCapacity} fans)\n`;
        });
        // 4. Formulate the operational prompt
        const recommendationPrompt = `
Generate a concise, actionable crowd capacity mitigation plan.
The target zone "${alert.zone.name}" (${alert.zone.zoneType}) is experiencing a ${alert.severity} density spike, currently at ${targetPct}% capacity (${targetCount}/${alert.zone.maxCapacity} fans).

Alternative available stadium zones:
${adjacentStatsText}

Provide:
1. Short justification of the situation.
2. Clear, numbered rerouting instructions for venue staff and volunteers to redirect traffic away from "${alert.zone.name}" to the lowest density alternative zones.
Keep it under 150 words.
`;
        // 5. Query Gemini
        const geminiResult = await (0, geminiClient_1.askGemini)(recommendationPrompt);
        // 6. Persist generated recommendation in database
        const updatedAlert = await db_client_1.prisma.alert.update({
            where: { id: alertId },
            data: {
                aiRecommendation: geminiResult.responseText,
            },
            include: {
                zone: true,
            },
        });
        res.status(200).json({
            alertId: updatedAlert.id,
            recommendation: updatedAlert.aiRecommendation,
        });
    }
    catch (error) {
        console.error('Error generating AI recommendation:', error);
        res.status(500).json({ error: 'Failed to generate AI recommendation' });
    }
});
exports.default = router;
