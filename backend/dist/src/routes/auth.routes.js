"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-signing-key-for-matchday';
const router = (0, express_1.Router)();
// POST /api/v1/auth/login - Login for staff/admin
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Dummy authentication for setup phase
    if (username === 'staff' && password === 'password') {
        const token = jsonwebtoken_1.default.sign({ id: 'mock-staff-id', role: 'staff' }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token });
        return;
    }
    res.status(401).json({ error: 'Invalid credentials' });
});
// POST /api/v1/auth/refresh - Refresh JWT token
router.post('/refresh', (req, res) => {
    res.status(200).json({
        token: 'mock-refreshed-token',
    });
});
exports.default = router;
