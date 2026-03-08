import express from 'express';
import logger from '../logger.js';
import {
  addClient,
  removeClient,
  sendToClient,
  broadcastLog,
  broadcastSessionUpdate,
} from '../logStream.js';

const router = express.Router();

// GET stream logs (Server-Sent Events)
router.get('/stream', (req, res) => {
  const clientId = Date.now();

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Register client
  const client = { id: clientId, res };
  addClient(client);

  logger.debug(`SSE client connected: ${clientId}`);

  // Send initial connection message
  sendToClient(client, {
    type: 'connected',
    message: 'Logger connected',
    timestamp: new Date().toISOString(),
  });

  // Handle client disconnect
  req.on('close', () => {
    removeClient(client);
    logger.debug(`SSE client disconnected: ${clientId}`);
  });

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    sendToClient(client, { type: 'ping' });
  }, 30000);

  res.on('close', () => clearInterval(keepAliveInterval));
});

export default router;
export { broadcastLog, broadcastSessionUpdate };
