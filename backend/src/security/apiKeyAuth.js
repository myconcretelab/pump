import { Buffer } from 'buffer';
import { timingSafeEqual } from 'crypto';

function getConfiguredApiKey() {
  return String(process.env.PUMP_API_KEY || '').trim();
}

function getPresentedApiKey(req, options = {}) {
  const headerKey = String(req.get('x-api-key') || '').trim();
  if (headerKey) {
    return headerKey;
  }

  const authHeader = String(req.get('authorization') || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (options.allowQuery) {
    return String(req.query.apiKey || '').trim();
  }

  return '';
}

function keysMatch(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf-8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf-8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function requireConfiguredApiKey(req, res, next) {
  const configuredApiKey = getConfiguredApiKey();
  if (!configuredApiKey) {
    return next();
  }

  const presentedApiKey = getPresentedApiKey(req, {
    allowQuery: req.path === '/logs/stream',
  });

  if (!presentedApiKey || !keysMatch(presentedApiKey, configuredApiKey)) {
    return res.status(401).json({
      error: 'Invalid API key',
    });
  }

  next();
}

export {
  getConfiguredApiKey,
  getPresentedApiKey,
  requireConfiguredApiKey,
};
