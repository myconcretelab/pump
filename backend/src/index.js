import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import configRoutes from './routes/config.js';
import sessionRoutes from './routes/session.js';
import resultsRoutes from './routes/results.js';
import logsRoutes from './routes/logs.js';
import reservationsRoutes from './routes/reservations.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/config', configRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reservations', reservationsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Frontend: ${FRONTEND_URL}`);
  logger.info(`📍 API: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  logger.info('Server shutting down...');
  process.exit(0);
});
