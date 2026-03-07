import express from 'express';
import configManager from '../config/configManager.js';
import logger from '../logger.js';
import sessionRegistry from '../storage/sessionRegistry.js';
import { extractReservationsFromSession } from '../results/reservations.js';
import { getActiveSessionStatus, startBackgroundSession } from './session.js';

const router = express.Router();
const FINISHED_STATUSES = new Set(['completed', 'failed', 'stopped']);
let latestRefreshSessionId = null;

function getConfiguredApiKey() {
  return String(process.env.PUMP_API_KEY || '').trim();
}

function getPresentedApiKey(req) {
  const headerKey = String(req.get('x-api-key') || '').trim();
  if (headerKey) {
    return headerKey;
  }

  const authHeader = String(req.get('authorization') || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}

function requireApiKey(req, res, next) {
  const configuredApiKey = getConfiguredApiKey();
  if (!configuredApiKey) {
    return res.status(503).json({
      error: 'Reservations API is not configured',
    });
  }

  const presentedApiKey = getPresentedApiKey(req);
  if (!presentedApiKey || presentedApiKey !== configuredApiKey) {
    return res.status(401).json({
      error: 'Invalid API key',
    });
  }

  next();
}

function findLatestFinishedSession() {
  const sessions = sessionRegistry.listSessions(100);
  return sessions.find((session) => FINISHED_STATUSES.has(session.status) && session.storageDir) || null;
}

function findLatestRefreshSession() {
  if (latestRefreshSessionId) {
    const targetedSession = sessionRegistry.getSession(latestRefreshSessionId);
    if (targetedSession) {
      return targetedSession;
    }
  }

  return sessionRegistry.listSessions(100)[0] || null;
}

router.use(requireApiKey);

router.get('/latest', (req, res) => {
  try {
    const latestSession = findLatestFinishedSession();
    if (!latestSession) {
      return res.status(404).json({
        error: 'No finished session available yet',
      });
    }

    const extracted = extractReservationsFromSession(latestSession.storageDir);
    res.json({
      sessionId: latestSession.sessionId,
      status: latestSession.status,
      updatedAt: latestSession.updatedAt || latestSession.createdAt || null,
      reservationCount: extracted.reservations.length,
      stats: extracted.stats,
      reservations: extracted.reservations,
    });
  } catch (err) {
    logger.error('Failed to serve latest reservations', { error: err.message });
    res.status(500).json({
      error: 'Failed to serve latest reservations',
    });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const storedConfig = configManager.loadConfig();
    const body = {
      config: storedConfig,
    };

    if (process.env.PUMP_SESSION_PASSWORD) {
      body.password = process.env.PUMP_SESSION_PASSWORD;
    }

    const { sessionId } = startBackgroundSession(body, { allowStoredPassword: true });
    latestRefreshSessionId = sessionId;

    res.status(202).json({
      success: true,
      sessionId,
      status: 'starting',
      message: 'Refresh session started',
    });
  } catch (err) {
    logger.error('Failed to start reservations refresh', { error: err.message });
    res.status(err.validationErrors ? 400 : 500).json({
      success: false,
      error: err.message,
      details: err.validationErrors || [],
    });
  }
});

router.get('/status', (req, res) => {
  try {
    const latestSession = findLatestRefreshSession();
    if (!latestSession) {
      return res.json({
        sessionId: null,
        status: 'idle',
        reservationCount: 0,
      });
    }

    const activeStatus = getActiveSessionStatus(latestSession.sessionId);
    if (activeStatus) {
      return res.json({
        ...activeStatus,
        reservationCount: activeStatus.results?.reservationCount || 0,
      });
    }

    const extracted = latestSession.storageDir
      ? extractReservationsFromSession(latestSession.storageDir)
      : { reservations: [] };

    res.json({
      sessionId: latestSession.sessionId,
      status: latestSession.status || 'unknown',
      updatedAt: latestSession.updatedAt || latestSession.createdAt || null,
      reservationCount: extracted.reservations.length,
      errors: latestSession.lastError ? [{ message: latestSession.lastError }] : [],
      results: null,
    });
  } catch (err) {
    logger.error('Failed to read reservations refresh status', { error: err.message });
    res.status(500).json({
      error: 'Failed to read reservations refresh status',
    });
  }
});

export default router;
