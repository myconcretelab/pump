import logger from '../logger.js';
import filterEngine from './filter.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseBodyWithTimeout(response, contentType, timeoutMs = 3000) {
  let bodyPromise = null;

  if (contentType.includes('application/json')) {
    bodyPromise = response
      .json()
      .then((value) => ({ value, isJson: true }))
      .catch((error) => ({ error }));
  } else if (contentType.includes('text/')) {
    bodyPromise = response
      .text()
      .then((value) => ({ value, isJson: false }))
      .catch((error) => ({ error }));
  } else {
    return { body: null, isJson: false, timedOut: false };
  }

  const result = await Promise.race([
    bodyPromise,
    wait(timeoutMs).then(() => ({ timedOut: true })),
  ]);

  if (result?.timedOut) {
    return { body: null, isJson: false, timedOut: true };
  }

  if (result?.error) {
    throw result.error;
  }

  return {
    body: result?.value ?? null,
    isJson: Boolean(result?.isJson),
    timedOut: false,
  };
}

class NetworkCapture {
  constructor(page, filters = {}) {
    this.page = page;
    this.filters = filters;
    this.capturedResponses = [];
    this.capturedRequests = new Map();
    this.context = 'before-scroll'; // before-scroll, during-scroll, after-scroll
    this.isListening = false;
    this.pendingResponses = new Map();
    this.lastActivityAt = Date.now();
    this.responseListener = null;
    this.requestListener = null;
  }

  async start() {
    if (this.isListening) {
      logger.warn('Network capture already started');
      return;
    }

    try {
      logger.info('Starting network capture...');

      // Intercept all responses
      this.responseListener = (response) => {
        this.lastActivityAt = Date.now();
        const startedAt = Date.now();
        const pending = this.handleResponse(response).finally(() => {
          this.pendingResponses.delete(pending);
          this.lastActivityAt = Date.now();
        });
        this.pendingResponses.set(pending, {
          startedAt,
          url: response.url(),
          method: response.request().method(),
        });
      };

      // Intercept all requests
      this.requestListener = (request) => {
        this.lastActivityAt = Date.now();
        this.handleRequest(request);
      };

      this.page.on('response', this.responseListener);
      this.page.on('request', this.requestListener);

      this.isListening = true;
      logger.info('Network capture started');
    } catch (err) {
      logger.error('Failed to start network capture', { error: err.message });
      throw err;
    }
  }

  handleRequest(request) {
    const key = `${request.method()}:${request.url()}:${this.capturedRequests.size}`;
    this.capturedRequests.set(key, {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      timestamp: new Date().toISOString(),
      context: this.context,
    });
  }

  async waitForSettled(options = {}) {
    const { idleMs = 1000, timeoutMs = 10000, pollMs = 100, stalePendingMs = 5000 } = options;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const idleFor = Date.now() - this.lastActivityAt;
      const pendingEntries = [...this.pendingResponses.entries()];

      if (pendingEntries.length === 0 && idleFor >= idleMs) {
        return true;
      }

      if (pendingEntries.length > 0) {
        const stalePending = pendingEntries.filter(([, metadata]) => {
          return Date.now() - metadata.startedAt >= stalePendingMs;
        });

        if (idleFor >= idleMs && stalePending.length === pendingEntries.length) {
          logger.warn('Finalizing with stale pending responses', {
            pendingResponses: pendingEntries.length,
            stalePendingMs,
            urls: stalePending.map(([, metadata]) => metadata.url).slice(0, 5),
          });
          return false;
        }
      }

      const remainingMs = timeoutMs - (Date.now() - start);
      await Promise.race([
        Promise.allSettled(pendingEntries.map(([pending]) => pending)),
        wait(Math.min(pollMs, idleMs, remainingMs)),
      ]);
    }

    logger.warn('Network capture settle timeout reached', {
      pendingResponses: this.pendingResponses.size,
      idleFor: Date.now() - this.lastActivityAt,
    });
    return false;
  }

  async handleResponse(response) {
    try {
      const url = response.url();
      const method = response.request().method();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';

      let body = null;
      let isJson = false;

      // Try to extract body
      try {
        const bodyResult = await readResponseBodyWithTimeout(response, contentType);
        if (bodyResult.timedOut) {
          logger.debug('Response body extraction timed out', { url, contentType });
        } else {
          body = bodyResult.body;
          isJson = bodyResult.isJson;
        }
      } catch (err) {
        logger.debug('Could not extract response body', { url, error: err.message });
        // Continue without body
      }

      const request = {
        url,
        method,
        headers: response.request().headers(),
      };

      const responseData = {
        url,
        method,
        status,
        headers: response.headers(),
        contentType,
        body,
        isJson,
        timestamp: new Date().toISOString(),
        context: this.context,
      };

      // Check if should keep
      const shouldKeep = filterEngine.shouldKeepResponse(request, responseData, this.filters);
      const explanation = filterEngine.getFilterExplanation(request, responseData, this.filters);

      const captured = {
        ...responseData,
        filterExplanation: explanation,
        keptByFilters: shouldKeep,
        requestHeaders: request.headers,
      };
      this.capturedResponses.push(captured);

      if (shouldKeep) {
        logger.debug(`API captured: ${method} ${url} [${status}]`, {
          context: this.context,
        });
      } else {
        logger.debug(`API filtered: ${method} ${url}`, { explanation });
      }
    } catch (err) {
      logger.warn('Error handling response', { error: err.message });
    }
  }

  setContext(context) {
    this.context = context;
    logger.debug(`Network capture context changed to: ${context}`);
  }

  getResponses(options = {}) {
    const { keptOnly = false, filteredOnly = false } = options;

    if (keptOnly) {
      return this.getKeptResponses();
    }

    if (filteredOnly) {
      return this.getFilteredResponses();
    }

    return [...this.capturedResponses];
  }

  getResponseCount() {
    return this.capturedResponses.length;
  }

  getKeptResponses() {
    return this.capturedResponses.filter((response) => response.keptByFilters);
  }

  getKeptResponseCount() {
    return this.getKeptResponses().length;
  }

  getFilteredResponses() {
    return this.capturedResponses.filter((response) => !response.keptByFilters);
  }

  getFilteredResponseCount() {
    return this.getFilteredResponses().length;
  }

  getTotalRequestsCount() {
    return this.capturedRequests.size;
  }

  getSummary() {
    return {
      totalRequests: this.getTotalRequestsCount(),
      totalResponses: this.getResponseCount(),
      keptResponses: this.getKeptResponseCount(),
      filteredResponses: this.getFilteredResponseCount(),
      byStatus: this.groupByStatus(),
      byContentType: this.groupByContentType(),
      byContext: this.groupByContext(),
      byFilterDecision: this.groupByFilterDecision(),
    };
  }

  groupByStatus() {
    const groups = {};
    this.capturedResponses.forEach((resp) => {
      if (!groups[resp.status]) {
        groups[resp.status] = 0;
      }
      groups[resp.status]++;
    });
    return groups;
  }

  groupByContentType() {
    const groups = {};
    this.capturedResponses.forEach((resp) => {
      const ct = resp.contentType || 'unknown';
      if (!groups[ct]) {
        groups[ct] = 0;
      }
      groups[ct]++;
    });
    return groups;
  }

  groupByContext() {
    const groups = {};
    this.capturedResponses.forEach((resp) => {
      const ctx = resp.context || 'unknown';
      if (!groups[ctx]) {
        groups[ctx] = 0;
      }
      groups[ctx]++;
    });
    return groups;
  }

  groupByFilterDecision() {
    return this.capturedResponses.reduce(
      (groups, response) => {
        const key = response.keptByFilters ? 'kept' : 'filtered';
        groups[key] += 1;
        return groups;
      },
      { kept: 0, filtered: 0 }
    );
  }

  stop() {
    if (this.page && this.responseListener) {
      this.page.off('response', this.responseListener);
    }
    if (this.page && this.requestListener) {
      this.page.off('request', this.requestListener);
    }
    this.responseListener = null;
    this.requestListener = null;
    this.isListening = false;
    logger.info('Network capture stopped');
  }
}

export default NetworkCapture;
