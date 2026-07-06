"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_routes_1 = __importDefault(require("./chat.routes"));
const density_routes_1 = __importDefault(require("./density.routes"));
const alerts_routes_1 = __importDefault(require("./alerts.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const health_routes_1 = __importDefault(require("./health.routes"));
const apiRouter = (0, express_1.Router)();
// Mount sub-routers matching architecture.md routes
apiRouter.use('/chat', chat_routes_1.default);
// For /api/v1/navigation/route
const navigationRouter = (0, express_1.Router)();
navigationRouter.post('/route', (req, res) => {
    const { startZoneId, endZoneId } = req.body;
    res.status(200).json({
        startZoneId,
        endZoneId,
        directions: ['Go straight for 50m', 'Turn left at Gate B concourse'],
        pathOverlaySvgUrl: null,
    });
});
apiRouter.use('/navigation', navigationRouter);
// For /api/v1/zones/:venueId
const zonesRouter = (0, express_1.Router)();
zonesRouter.get('/:venueId', (req, res) => {
    const { venueId } = req.params;
    res.status(200).json([]);
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
