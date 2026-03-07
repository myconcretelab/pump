import express from 'express';
import configManager from '../config/configManager.js';
import validation from '../config/validation.js';
import PlaywrightSession from '../playwright/session.js';
import NetworkCapture from '../network/capture.js';
import SessionSaver from '../export/saver.js';
import naming from '../export/naming.js';
import logger from '../logger.js';
import { broadcastSessionUpdate } from './logs.js';
import sessionRegistry from '../storage/sessionRegistry.js';

const router = express.Router();
const activeSessions = new Map();
const SESSION_RETENTION_MS = 10 * 60 * 1000;

function buildEffectiveConfig(body = {}, options = {}) {
  const storedConfig = configManager.loadConfig();
  const incomingConfig = body.config || {};

  const config = {
    ...storedConfig,
    ...incomingConfig,
    filterRules: {
      ...storedConfig.filterRules,
      ...incomingConfig.filterRules,
    },
    advancedSelectors: {
      ...storedConfig.advancedSelectors,
      ...incomingConfig.advancedSelectors,
    },
  };

  if (body.password) {
    config.password = body.password;
  }

  if (!options.allowStoredPassword && !body.password) {
    config.password = '';
  }

  return config;
}

function validateEffectiveConfig(config) {
  const result = validation.validateConfig(config);
  if (!result.valid) {
    const error = new Error(`Invalid configuration: ${result.errors.join(', ')}`);
    error.validationErrors = result.errors;
    throw error;
  }
}

function setSessionStatus(sessionData, status, data = {}) {
  sessionData.status = status;
  broadcastSessionUpdate(sessionData.sessionId, status, data);
  sessionRegistry.upsertSession(sessionData.sessionId, {
    status,
    storageDir: sessionData.saver.getSessionDir(),
    lastError: data.error || null,
  });
}

function throwIfCancelled(sessionData) {
  if (sessionData.cancelRequested) {
    const error = new Error('Session stopped by user');
    error.code = 'SESSION_CANCELLED';
    throw error;
  }
}

async function persistSessionArtifacts(sessionData, duration, errors = []) {
  const responses = sessionData.networkCapture.getResponses();
  let savedCount = 0;
  const persistenceErrors = [];

  for (let i = 0; i < responses.length; i++) {
    try {
      const filename = sessionData.saver.saveResponse(responses[i], i);
      responses[i].filename = filename;
      savedCount++;
    } catch (err) {
      logger.warn(`Failed to save response ${i}`, { error: err.message });
      persistenceErrors.push(`response ${i}: ${err.message}`);
    }
  }

  try {
    sessionData.saver.saveMetadata(sessionData.networkCapture);
  } catch (err) {
    logger.error('Failed to persist metadata', { error: err.message, sessionId: sessionData.sessionId });
    persistenceErrors.push(`metadata: ${err.message}`);
  }

  try {
    sessionData.saver.saveSessionSummary(sessionData.networkCapture, errors, duration);
  } catch (err) {
    logger.error('Failed to persist session summary', {
      error: err.message,
      sessionId: sessionData.sessionId,
    });
    persistenceErrors.push(`summary: ${err.message}`);
  }

  sessionData.saver.saveHAR(sessionData.networkCapture);
  sessionData.saver.saveResponsesLog(sessionData.networkCapture);

  sessionData.results = {
    sessionId: sessionData.sessionId,
    savedResponses: savedCount,
    totalRequests: sessionData.networkCapture.getTotalRequestsCount(),
    totalResponses: sessionData.networkCapture.getResponseCount(),
    keptResponses: sessionData.networkCapture.getKeptResponseCount(),
    filteredResponses: sessionData.networkCapture.getFilteredResponseCount(),
    sessionDir: sessionData.saver.getSessionDir(),
    summary: sessionData.networkCapture.getSummary(),
    persistenceErrors,
  };

  return sessionData.results;
}

function sanitizeSessionStatusResponse(sessionId, session) {
  if (!session) {
    return null;
  }

  return {
    sessionId,
    status: session.status,
    duration: Date.now() - session.startTime,
    errors: session.errors,
    results: session.results,
  };
}

function scheduleSessionCleanup(sessionId) {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) {
    return;
  }

  if (sessionData.cleanupTimer) {
    clearTimeout(sessionData.cleanupTimer);
  }

  sessionData.cleanupTimer = setTimeout(() => {
    activeSessions.delete(sessionId);
  }, SESSION_RETENTION_MS);
}

router.post('/test-connection', async (req, res) => {
  try {
    logger.info('Testing connection...');
    const config = buildEffectiveConfig(req.body, { allowStoredPassword: true });
    validateEffectiveConfig(config);

    const session = new PlaywrightSession(config);
    const result = await session.testLogin();

    logger.info('Connection test successful');
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Connection test failed', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message,
      details: err.validationErrors || [],
    });
  }
});

router.post('/test-scroll-target', async (req, res) => {
  try {
    logger.info('Testing scroll target...');
    const config = buildEffectiveConfig(req.body, { allowStoredPassword: true });
    validateEffectiveConfig(config);

    const session = new PlaywrightSession(config);
    const result = await session.testScrollTarget();

    logger.info('Scroll target test successful');
    res.json(result);
  } catch (err) {
    logger.error('Scroll target test failed', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message,
      details: err.validationErrors || [],
    });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { sessionId } = startBackgroundSession(req.body, { allowStoredPassword: true });
    res.json({
      success: true,
      sessionId,
      message: 'Session started, executing in background',
    });
  } catch (err) {
    logger.error('Failed to start session', { error: err.message });
    res.status(err.validationErrors ? 400 : 500).json({
      success: false,
      error: 'Failed to start session',
      details: err.validationErrors || [],
    });
  }
});

async function executeSession(sessionId) {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) {
    return;
  }

  const { playwright, networkCapture, saver } = sessionData;
  const startTime = Date.now();

  try {
    logger.info('Session execution started', { sessionId });
    setSessionStatus(sessionData, 'running');
    throwIfCancelled(sessionData);

    await playwright.initialize();
    networkCapture.page = playwright.getPage();
    await networkCapture.start();

    networkCapture.setContext('before-login');
    throwIfCancelled(sessionData);
    await playwright.navigate(sessionData.playwright.config.baseUrl);

    networkCapture.setContext('login');
    throwIfCancelled(sessionData);
    await playwright.performLogin();

    networkCapture.setContext('before-scroll');
    throwIfCancelled(sessionData);
    await playwright.waitBeforeAction();

    networkCapture.setContext('during-scroll');
    throwIfCancelled(sessionData);
    await playwright.performScrollSequence();

    networkCapture.setContext('after-scroll');
    await networkCapture.waitForSettled();
    throwIfCancelled(sessionData);

    await persistSessionArtifacts(sessionData, Date.now() - startTime, []);
    setSessionStatus(sessionData, 'completed', { sessionDir: saver.getSessionDir() });
    logger.info('Session completed successfully', sessionData.results);
  } catch (err) {
    if (!sessionData.cancelRequested && err.code !== 'SESSION_CANCELLED') {
      logger.error('Session execution failed', { error: err.message, sessionId });
      sessionData.errors.push({
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    await networkCapture.waitForSettled({ idleMs: 250, timeoutMs: 3000 }).catch(() => {});
    await persistSessionArtifacts(sessionData, Date.now() - startTime, sessionData.errors);

    if (sessionData.cancelRequested || err.code === 'SESSION_CANCELLED') {
      setSessionStatus(sessionData, 'stopped');
    } else {
      setSessionStatus(sessionData, 'failed', { error: err.message });
    }
  } finally {
    await playwright.close();
    networkCapture.stop();
    scheduleSessionCleanup(sessionId);
  }
}

router.get('/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const session = getActiveSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(sanitizeSessionStatusResponse(sessionId, session));
});

router.post('/:sessionId/stop', async (req, res) => {
  const { sessionId } = req.params;
  const session = getActiveSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    if (['completed', 'failed', 'stopped'].includes(session.status)) {
      return res.json({ success: true, message: `Session already ${session.status}` });
    }

    session.cancelRequested = true;
    setSessionStatus(session, 'stopping');
    await session.playwright.close();
    logger.info('Session stopped manually', { sessionId });
    res.json({ success: true, message: 'Session stop requested' });
  } catch (err) {
    logger.error('Failed to stop session', { error: err.message });
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

export function startBackgroundSession(body = {}, options = {}) {
  const sessionId = naming.generateSessionId();
  try {
    logger.info('Starting new session', { sessionId });
    const config = buildEffectiveConfig(body, { allowStoredPassword: options.allowStoredPassword !== false });
    validateEffectiveConfig(config);

    const playwright = new PlaywrightSession(config);
    const networkCapture = new NetworkCapture(null, config.filterRules);
    const saver = new SessionSaver(sessionId, config);

    activeSessions.set(sessionId, {
      sessionId,
      playwright,
      networkCapture,
      saver,
      status: 'starting',
      startTime: Date.now(),
      errors: [],
      results: null,
      cancelRequested: false,
      cleanupTimer: null,
    });

    sessionRegistry.upsertSession(sessionId, {
      sessionId,
      status: 'starting',
      createdAt: new Date().toISOString(),
      storageDir: saver.getSessionDir(),
    });
    broadcastSessionUpdate(sessionId, 'starting');

    executeSession(sessionId);

    return {
      sessionId,
      config,
    };
  } catch (err) {
    activeSessions.delete(sessionId);
    throw err;
  }
}

export function getActiveSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

export function getActiveSessionStatus(sessionId) {
  return sanitizeSessionStatusResponse(sessionId, getActiveSession(sessionId));
}

export default router;
