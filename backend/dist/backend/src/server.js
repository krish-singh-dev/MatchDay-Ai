"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = void 0;
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const redis_client_1 = require("./config/redis.client");
const events_1 = require("./socket/events");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const server = http_1.default.createServer(app_1.default);
exports.server = server;
// Initialize Socket.IO with CORS settings matching Express CORS config
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});
exports.io = io;
async function startServer() {
    // Connect to Redis
    await (0, redis_client_1.initRedis)();
    // Initialize Socket.IO events helper
    (0, events_1.initSocketEvents)(io);
    io.on('connection', (socket) => {
        console.log(`Socket client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`Socket client disconnected: ${socket.id}`);
        });
    });
    server.listen(PORT, () => {
        console.log(`MatchDay AI Backend server running on port ${PORT}`);
    });
}
startServer().catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
});
