"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_routes_1 = __importDefault(require("./chat.routes"));
const navigation_routes_1 = __importDefault(require("./navigation.routes"));
const density_routes_1 = __importDefault(require("./density.routes"));
const alerts_routes_1 = __importDefault(require("./alerts.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const health_routes_1 = __importDefault(require("./health.routes"));
const db_client_1 = require("../config/db.client");
const apiRouter = (0, express_1.Router)();
// Mount sub-routers matching architecture.md routes
apiRouter.use('/chat', chat_routes_1.default);
apiRouter.use('/navigation', navigation_routes_1.default);
// For /api/v1/zones/:venueId
const zonesRouter = (0, express_1.Router)();
zonesRouter.get('/:venueId', async (req, res) => {
    try {
        const { venueId } = req.params;
        const zones = await db_client_1.prisma.zone.findMany({
            where: { venueId },
            include: {
                densityReadings: {
                    orderBy: { recordedAt: 'desc' },
                    take: 1,
                },
            },
        });
        const formattedZones = zones.map((z) => {
            const reading = z.densityReadings[0];
            return {
                id: z.id,
                venueId: z.venueId,
                name: z.name,
                zoneType: z.zoneType,
                maxCapacity: z.maxCapacity,
                geoCoordinates: z.geoCoordinates,
                estimatedCount: reading ? reading.estimatedCount : 0,
                densityPct: reading ? parseFloat(reading.densityPct.toString()) : 0.0,
                recordedAt: reading ? reading.recordedAt : null,
            };
        });
        res.status(200).json(formattedZones);
    }
    catch (error) {
        console.error('Error fetching zones:', error);
        res.status(500).json({ error: 'Failed to fetch zones' });
    }
});
apiRouter.use('/zones', zonesRouter);
// For /api/v1/density/ingest
apiRouter.use('/density', density_routes_1.default);
// For /api/v1/alerts/*
apiRouter.use('/alerts', alerts_routes_1.default);
// For /api/v1/auth/*
apiRouter.use('/auth', auth_routes_1.default);
// For /api/v1/health
apiRouter.use('/health', health_routes_1.default);
exports.default = apiRouter;
