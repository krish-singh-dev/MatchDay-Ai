import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin or if origin matches our allowedOrigin
    // or if it is a deployed Railway subdomain
    if (!origin || origin === allowedOrigin || origin.endsWith('.up.railway.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const corsMiddleware = cors(corsOptions);
