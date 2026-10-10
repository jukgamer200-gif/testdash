/**
 * RexaCloud Express Application Builder
 * Mounts secure middlewares, JSON parsing, and API routers.
 */

import express, { Request, Response, NextFunction } from 'express';
import apiRouter from './routes/api.js';

export function createApp() {
  const app = express();

  // Parse incoming JSON payloads with safe body size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request identification & timing
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Powered-By', 'RexaCloud-Engine');
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Fallback API 404 handler
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `API endpoint ${req.method} ${req.baseUrl} does not exist`,
    });
  });

  // Global centralized error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred during request processing',
    });
  });

  return app;
}
