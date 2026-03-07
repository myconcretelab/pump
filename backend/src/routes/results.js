import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import logger from '../logger.js';
import sessionRegistry from '../storage/sessionRegistry.js';
import { extractReservationsFromSession } from '../results/reservations.js';

const router = express.Router();
const SEARCH_TEXT_LIMIT = 4000;
const SEARCH_DOCUMENT_LIMIT = 200000;
const SEARCH_SNIPPET_RADIUS = 80;

// GET list of sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = sessionRegistry.listSessions(20);
    res.json({ sessions });
  } catch (err) {
    logger.error('Failed to list sessions', { error: err.message });
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET session metadata
router.get('/:sessionId/metadata', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionRegistry.getSession(sessionId);
    if (!session?.storageDir) {
      return res.status(404).json({ error: 'Session metadata not found' });
    }
    const metadataPath = join(session.storageDir, 'metadata.json');

    if (!existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Session metadata not found' });
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    metadata.responses = (metadata.responses || []).map((response) => {
      if (response.searchText || !response.filename) {
        return response;
      }

      const responsePath = join(session.storageDir, 'responses', response.filename);
      if (!existsSync(responsePath)) {
        return response;
      }

      try {
        const fullResponse = JSON.parse(readFileSync(responsePath, 'utf-8'));
        return {
          ...response,
          searchText: buildResponseSearchText(fullResponse),
        };
      } catch (readError) {
        logger.warn('Failed to backfill response search text', {
          error: readError.message,
          sessionId,
          filename: response.filename,
        });
        return response;
      }
    });
    res.json(metadata);
  } catch (err) {
    logger.error('Failed to read metadata', { error: err.message });
    res.status(500).json({ error: 'Failed to read metadata' });
  }
});

// GET session summary
router.get('/:sessionId/summary', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionRegistry.getSession(sessionId);
    if (!session?.storageDir) {
      return res.status(404).json({ error: 'Session summary not found' });
    }
    const summaryPath = join(session.storageDir, 'session_summary.json');

    if (!existsSync(summaryPath)) {
      return res.status(404).json({ error: 'Session summary not found' });
    }

    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    res.json(summary);
  } catch (err) {
    logger.error('Failed to read summary', { error: err.message });
    res.status(500).json({ error: 'Failed to read summary' });
  }
});

// GET extracted reservations found in the saved responses
router.get('/:sessionId/reservations', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionRegistry.getSession(sessionId);
    if (!session?.storageDir) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = extractReservationsFromSession(session.storageDir);
    res.json(result);
  } catch (err) {
    logger.error('Failed to extract reservations', { error: err.message });
    res.status(500).json({ error: 'Failed to extract reservations' });
  }
});

// GET full-text search over saved responses
router.get('/:sessionId/search', (req, res) => {
  try {
    const { sessionId } = req.params;
    const query = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '200', 10) || 200, 500));
    const excludeNoise = String(req.query.excludeNoise || 'false') === 'true';
    const session = sessionRegistry.getSession(sessionId);

    if (!session?.storageDir) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!query) {
      return res.json({ query: '', totalMatches: 0, matches: [] });
    }

    const metadataPath = join(session.storageDir, 'metadata.json');
    if (!existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Session metadata not found' });
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const normalizedQuery = query.toLowerCase();
    const matches = [];

    for (const response of metadata.responses || []) {
      if (excludeNoise && isLikelyNoiseResponse(response)) {
        continue;
      }

      const searchDocument = getSearchDocument(session.storageDir, response);
      const normalizedDocument = searchDocument.toLowerCase();
      const matchIndex = normalizedDocument.indexOf(normalizedQuery);

      if (matchIndex === -1) {
        continue;
      }

      matches.push({
        key: getResponseKey(response),
        filename: response.filename || null,
        snippet: extractSearchSnippet(searchDocument, matchIndex, query.length),
      });

      if (matches.length >= limit) {
        break;
      }
    }

    res.json({
      query,
      totalMatches: matches.length,
      matches,
    });
  } catch (err) {
    logger.error('Failed to search responses', { error: err.message });
    res.status(500).json({ error: 'Failed to search responses' });
  }
});

// GET response by file
router.get('/:sessionId/responses/:filename', (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const session = sessionRegistry.getSession(sessionId);
    if (!session?.storageDir) {
      return res.status(404).json({ error: 'Response not found' });
    }
    const responsePath = join(session.storageDir, 'responses', filename);

    if (!existsSync(responsePath)) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const response = JSON.parse(readFileSync(responsePath, 'utf-8'));
    res.json(response);
  } catch (err) {
    logger.error('Failed to read response', { error: err.message });
    res.status(500).json({ error: 'Failed to read response' });
  }
});

function buildResponseSearchText(response) {
  const parts = [
    response.url,
    response.method,
    response.contentType,
    response.context,
    response.filterExplanation,
  ];

  if (typeof response.body === 'string') {
    parts.push(response.body);
  } else if (response.body !== null && response.body !== undefined) {
    try {
      parts.push(JSON.stringify(response.body));
    } catch (err) {
      logger.debug('Failed to stringify response body for metadata search', {
        error: err.message,
      });
    }
  }

  return parts
    .filter(Boolean)
    .join('\n')
    .slice(0, SEARCH_TEXT_LIMIT);
}

function buildResponseSearchDocument(response) {
  const parts = [
    response.url,
    response.method,
    response.contentType,
    response.context,
    response.filterExplanation,
  ];

  if (typeof response.body === 'string') {
    parts.push(response.body);
  } else if (response.body !== null && response.body !== undefined) {
    try {
      parts.push(JSON.stringify(response.body));
    } catch (err) {
      logger.debug('Failed to stringify response body for full-text search', {
        error: err.message,
      });
    }
  }

  return parts
    .filter(Boolean)
    .join('\n')
    .slice(0, SEARCH_DOCUMENT_LIMIT);
}

function getSearchDocument(storageDir, response) {
  if (!response.filename) {
    return response.searchText || buildResponseSearchText(response);
  }

  const responsePath = join(storageDir, 'responses', response.filename);
  if (!existsSync(responsePath)) {
    return response.searchText || buildResponseSearchText(response);
  }

  try {
    const fullResponse = JSON.parse(readFileSync(responsePath, 'utf-8'));
    return buildResponseSearchDocument(fullResponse);
  } catch (err) {
    logger.warn('Failed to read response for full-text search', {
      error: err.message,
      filename: response.filename,
    });
    return response.searchText || buildResponseSearchText(response);
  }
}

function extractSearchSnippet(text, startIndex, matchLength) {
  const snippetStart = Math.max(0, startIndex - SEARCH_SNIPPET_RADIUS);
  const snippetEnd = Math.min(text.length, startIndex + matchLength + SEARCH_SNIPPET_RADIUS);
  const prefix = snippetStart > 0 ? '...' : '';
  const suffix = snippetEnd < text.length ? '...' : '';
  return `${prefix}${text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ')}${suffix}`;
}

function getResponseKey(response) {
  return response.filename || `${response.method}:${response.status}:${response.timestamp}:${response.url}`;
}

function isLikelyNoiseResponse(response) {
  const url = String(response.url || '').toLowerCase();
  const contentType = String(response.contentType || '').toLowerCase();

  const assetExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.css',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.map',
    '.js',
  ];

  const trackingMarkers = [
    'google-analytics',
    'analytics',
    'doubleclick',
    'facebook.com/tr',
    'hotjar',
    'amplitude',
    '/collect',
    '/marketing_event_tracking',
    '/airdog',
    'sgtm',
  ];

  return (
    assetExtensions.some((extension) => url.includes(extension)) ||
    contentType.startsWith('image/') ||
    contentType.includes('font/') ||
    contentType.includes('text/css') ||
    contentType.includes('javascript') ||
    trackingMarkers.some((marker) => url.includes(marker))
  );
}

export default router;
