"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_config_1 = require("./config/cors.config");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
// Global middleware
app.use((0, compression_1.default)());
app.use(cors_config_1.corsMiddleware);
app.use(express_1.default.json());
// API routes
app.use('/api/v1', routes_1.default);
// Fallback error handler
app.use((err, req, res, next) => {
    console.error('Express error handler caught:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});
exports.default = app;
