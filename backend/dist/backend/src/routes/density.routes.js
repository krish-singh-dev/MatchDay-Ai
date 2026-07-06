"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_client_1 = require("../config/db.client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const events_1 = require("../socket/events");
const library_1 = require("@prisma/client/runtime/library");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const router = (0, express_1.Router)();
// POST /api/v1/density/ingest - Ingest a new density reading
// Requires auth and staff/admin role
router.post('/ingest', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['staff', 'admin']), rateLimit_middleware_1.rateLimiter, async (req, res) => {
    try {
        const { zoneId, estimatedCount } = req.body;
        if (zoneId === undefined || estimatedCount === undefined || estimatedCount === null) {
            res.status(400).json({ error: 'Missing zoneId or estimatedCount parameters' });
            return;
        }
        // Strict boundary and type checks
        if (typeof estimatedCount !== 'number' || !Number.isInteger(estimatedCount) || estimatedCount < 0) {
            res.status(400).json({ error: 'estimatedCount must be a non-negative integer' });
            return;
        }
        if (typeof zoneId !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(zoneId)) {
            res.status(400).json({ error: 'zoneId must be a valid alphanumeric string' });
            return;
        }
        // 1. Fetch zone to check max capacity
        const zone = await db_client_1.prisma.zone.findUnique({
            where: { id: zoneId },
        });
        if (!zone) {
            res.status(404).json({ error: 'Zone not found' });
            return;
        }
        // 2. Calculate density percentage
        const densityPctValue = parseFloat((estimatedCount / zone.maxCapacity).toFixed(4));
        // 3. Save the density reading
        const reading = await db_client_1.prisma.densityReading.create({
            data: {
                zoneId,
                estimatedCount,
                densityPct: new library_1.Decimal(densityPctValue),
            },
        });
        // Cast Decimal to number for standard JSON output and socket updates
        const readingData = {
            ...reading,
            densityPct: densityPctValue,
        };
        // Emit live density update event via Socket.IO
        (0, events_1.emitDensityUpdate)(readingData);
        // 4. Threshold trigger checks
        let severity = null;
        if (densityPctValue >= 0.90) {
            severity = 'critical';
        }
        else if (densityPctValue >= 0.70) {
            severity = 'warning';
        }
        if (severity) {
            // Check if there is already an active (unresolved) alert of the same severity for this zone
            const existingAlert = await db_client_1.prisma.alert.findFirst({
                where: {
                    zoneId,
                    resolvedAt: null,
                },
            });
            if (!existingAlert) {
                // Create new Alert
                const alert = await db_client_1.prisma.alert.create({
                    data: {
                        zoneId,
                        severity,
                        aiRecommendation: 'Mitigation recommendation analysis pending. Request via operations console.',
                    },
                    include: {
                        zone: true,
                    },
                });
                // Emit live alert event via Socket.IO
                (0, events_1.emitNewAlert)(alert);
            }
            else if (existingAlert.severity !== severity) {
                // Update existing alert severity
                const updatedAlert = await db_client_1.prisma.alert.update({
                    where: { id: existingAlert.id },
                    data: { severity },
                    include: { zone: true },
                });
                (0, events_1.emitNewAlert)(updatedAlert);
            }
        }
        res.status(201).json(readingData);
    }
    catch (error) {
        console.error('Error ingesting density reading:', error);
        res.status(500).json({ error: 'Failed to ingest density reading' });
    }
});
exports.default = router;
