"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
exports.initRedis = initRedis;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl,
});
exports.redisClient.on('connect', () => {
    console.log('Redis client successfully connected to: ' + redisUrl);
});
exports.redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});
// Self-invoking connection logic for runtime verification
async function initRedis() {
    try {
        if (!exports.redisClient.isOpen) {
            await exports.redisClient.connect();
        }
    }
    catch (error) {
        console.error('Failed to initialize Redis connection:', error);
    }
}
