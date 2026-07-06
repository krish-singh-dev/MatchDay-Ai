import express from 'express';
import compression from 'compression';
import { corsMiddleware } from './config/cors.config';
import apiRouter from './routes';

const app = express();

// Global middleware
app.use(compression());
app.use(corsMiddleware);
app.use(express.json());

// API routes
app.use('/api/v1', apiRouter);

// Fallback error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error handler caught:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
