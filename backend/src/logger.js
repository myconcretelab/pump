import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { broadcastLog } from './logStream.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '../../data/logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

function formatTimestamp() {
  return new Date().toISOString();
}

function formatLog(level, message, data = null) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] ${level}`;
  
  if (data) {
    return `${prefix}: ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix}: ${message}`;
}

function writeToFile(message) {
  try {
    const date = new Date().toISOString().split('T')[0];
    const logFile = join(logsDir, `app-${date}.log`);
    writeFileSync(logFile, message + '\n', { flag: 'a' });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

function log(level, message, data = null) {
  const formatted = formatLog(level, message, data);
  console.log(formatted);
  broadcastLog(level, message, data);
  if (level === LOG_LEVELS.ERROR) {
    writeToFile(formatted);
  }
}

const logger = {
  debug: (msg, data) => log(LOG_LEVELS.DEBUG, msg, data),
  info: (msg, data) => log(LOG_LEVELS.INFO, msg, data),
  warn: (msg, data) => log(LOG_LEVELS.WARN, msg, data),
  error: (msg, data) => log(LOG_LEVELS.ERROR, msg, data),
};

export default logger;
