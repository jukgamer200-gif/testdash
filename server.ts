/**
 * RexaCloud Server Entry Point
 * Full-stack server combining Node.js Express API backend and Vite frontend dev middleware.
 * Runs on Port 3000 as required by the runtime environment.
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { createApp } from './backend/app.js';
import { config } from './backend/config.js';

async function startServer() {
  const app = createApp();
  const PORT = config.port;

  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProduction) {
    // Development mode: Hook Vite middlewares into Express
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve pre-built static bundle
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` RexaCloud Game Server Management Panel is running!`);
    console.log(` Port: ${PORT}`);
    console.log(` Mode: ${config.isDemoMode ? 'DEMO MODE (Sandbox)' : 'PRODUCTION (Connected to Pterodactyl)'}`);
    console.log(` API Base: http://localhost:${PORT}/api`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
