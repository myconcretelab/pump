import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import configRoutes from './routes/config.js';
import sessionRoutes from './routes/session.js';
import resultsRoutes from './routes/results.js';
import logsRoutes from './routes/logs.js';
import reservationsRoutes from './routes/reservations.js';
import logger from './logger.js';
import { getFrontendDistDir } from './runtime/paths.js';
import { requireConfiguredApiKey } from './security/apiKeyAuth.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
const frontendDistDir = getFrontendDistDir();
const hasFrontendDist = existsSync(frontendDistDir);

function getAllowedOrigins() {
  const configuredOrigins = String(FRONTEND_URL)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ['http://localhost:5174', 'http://127.0.0.1:5174'];
}

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (getAllowedOrigins().includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api', requireConfiguredApiKey);
app.use('/api/config', configRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reservations', reservationsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (hasFrontendDist) {
  app.use(express.static(frontendDistDir));

  app.get(/^\/(?!api(?:\/|$)|health$).*/, (req, res) => {
    res.sendFile(`${frontendDistDir}/index.html`);
  });
}

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Frontend: ${FRONTEND_URL}`);
  logger.info(`📍 API: http://localhost:${PORT}`);
  if (hasFrontendDist) {
    logger.info(`📦 Serving frontend build from ${frontendDistDir}`);
  } else {
    logger.warn('Frontend build not found; only API routes are available', {
      frontendDistDir,
    });
  }
});

process.on('SIGINT', () => {
  logger.info('Server shutting down...');
  process.exit(0);
});
