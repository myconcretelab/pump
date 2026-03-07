import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import logger from '../logger.js';
import naming from './naming.js';
import summary from './summary.js';
import har from '../network/har.js';
import sessionRegistry from '../storage/sessionRegistry.js';

class SessionSaver {
  constructor(sessionId, config) {
    this.sessionId = sessionId;
    this.config = config;
    const rootDir = config.outputFolder
      ? join(config.outputFolder, 'pump_sessions')
      : sessionRegistry.getDefaultSessionsRoot();
    this.baseDir = join(rootDir, sessionId);
    this.responsesDir = join(this.baseDir, 'responses');
    this.logsDir = join(this.baseDir, 'logs');
    this.initializeDirs();
  }

  initializeDirs() {
    try {
      mkdirSync(this.baseDir, { recursive: true });
      mkdirSync(this.responsesDir, { recursive: true });
      mkdirSync(this.logsDir, { recursive: true });
      logger.info(`Session directory created: ${this.baseDir}`);
    } catch (err) {
      logger.error('Failed to create session directories', {
        error: err.message,
        path: this.baseDir,
      });
      throw err;
    }
  }

  saveResponse(response, index) {
    try {
      const filename = naming.generateResponseFilename(response, index);
      const filepath = join(this.responsesDir, filename);

      const data = {
        filename,
        url: response.url,
        method: response.method,
        status: response.status,
        headers: response.headers,
        requestHeaders: response.requestHeaders,
        contentType: response.contentType,
        body: response.body,
        timestamp: response.timestamp,
        context: response.context,
        keptByFilters: response.keptByFilters,
        filterExplanation: response.filterExplanation,
      };

      writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug(`Response saved: ${filename}`);
      return filename;
    } catch (err) {
      logger.error('Failed to save response', {
        error: err.message,
        index,
      });
      throw err;
    }
  }

  saveMetadata(networkCapture) {
    try {
      const filename = naming.generateMetadataFilename();
      const filepath = join(this.baseDir, filename);

      const responses = networkCapture.getResponses();
      const data = summary.generateMetadata(this.sessionId, this.config, responses);

      writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`Metadata saved: ${filename}`);
      return filename;
    } catch (err) {
      logger.error('Failed to save metadata', { error: err.message });
      throw err;
    }
  }

  saveSessionSummary(networkCapture, errors = [], duration = 0) {
    try {
      const filename = naming.generateSummaryFilename();
      const filepath = join(this.baseDir, filename);

      const data = summary.generateSessionSummary(
        this.sessionId,
        this.config,
        networkCapture,
        errors,
        duration
      );

      writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`Session summary saved: ${filename}`);
      return filename;
    } catch (err) {
      logger.error('Failed to save session summary', { error: err.message });
      throw err;
    }
  }

  saveHAR(networkCapture) {
    try {
      if (!this.config.enableHAR) {
        logger.debug('HAR export disabled');
        return null;
      }

      const filename = naming.generateHARFilename();
      const filepath = join(this.baseDir, filename);

      const responses = networkCapture.getResponses();
      const data = har.generateHAR(responses, {
        sessionId: this.sessionId,
        duration: 0,
      });

      writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`HAR file saved: ${filename}`);
      return filename;
    } catch (err) {
      logger.error('Failed to save HAR file', { error: err.message });
      return null;
    }
  }

  saveResponsesLog(networkCapture) {
    try {
      const filename = naming.generateResponsesLogFilename();
      const filepath = join(this.logsDir, filename);

      const responses = networkCapture.getResponses();
      const lines = responses.map(
        (r, idx) =>
          `${idx + 1}. ${r.timestamp} | ${r.keptByFilters ? 'KEPT' : 'FILTERED'} | ${r.method} ${r.status} | ${r.context} | ${r.url}`
      );

      writeFileSync(filepath, lines.join('\n'), 'utf-8');
      logger.info(`Responses log saved: ${filename}`);
      return filename;
    } catch (err) {
      logger.error('Failed to save responses log', { error: err.message });
      return null;
    }
  }

  getSessionDir() {
    return this.baseDir;
  }

  getResponsesDir() {
    return this.responsesDir;
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      baseDir: this.baseDir,
      responsesDir: this.responsesDir,
      logsDir: this.logsDir,
    };
  }
}

export default SessionSaver;
