"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const limitStore = {};
const LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS = 60; // Max 60 queries per minute per IP
/**
 * Custom memory-based Express rate limiting middleware.
 * Defends the server and Gemini API endpoints from spamming and brute-force.
 */
function rateLimiter(req, res, next) {
    // Use testing overrides or standard IP headers
    const ip = req.headers['x-test-ip']?.toString() || req.ip || 'unknown-ip';
    const now = Date.now();
    if (!limitStore[ip]) {
        limitStore[ip] = {
            count: 1,
            resetTime: now + LIMIT_WINDOW_MS,
        };
        next();
        return;
    }
    const clientLimit = limitStore[ip];
    // If window elapsed, reset count
    if (now > clientLimit.resetTime) {
        clientLimit.count = 1;
        clientLimit.resetTime = now + LIMIT_WINDOW_MS;
        next();
        return;
    }
    clientLimit.count += 1;
    if (clientLimit.count > MAX_REQUESTS) {
        res.status(429).json({
            error: 'Too many requests. Please try again after a minute.',
        });
        return;
    }
    next();
}
