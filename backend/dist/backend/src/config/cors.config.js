"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = exports.corsOptions = void 0;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
exports.corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin or if origin matches our allowedOrigin
        // or if it is a deployed Railway subdomain
        if (!origin || origin === allowedOrigin || origin.endsWith('.up.railway.app')) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
exports.corsMiddleware = (0, cors_1.default)(exports.corsOptions);
