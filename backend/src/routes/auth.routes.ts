import { Router } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-signing-key-for-matchday';

const router = Router();

// POST /api/v1/auth/login - Login for staff/admin
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Dummy authentication for setup phase
  if (username === 'staff' && password === 'password') {
    const token = jwt.sign(
      { id: 'mock-staff-id', role: 'staff' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
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

export default router;
