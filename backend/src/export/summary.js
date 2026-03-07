import logger from '../logger.js';

const SEARCH_TEXT_LIMIT = 4000;

function generateSessionSummary(sessionId, config, networkCapture, errors = [], duration = 0) {
  const now = new Date().toISOString();

  return {
    session: {
      id: sessionId,
      startTime: now,
      duration: duration,
      success: errors.length === 0,
    },
    configuration: {
      baseUrl: config.baseUrl,
      scrollSelector: config.scrollSelector,
      scrollConfig: {
        count: config.scrollCount,
        distance: config.scrollDistance,
        delay: config.scrollDelay,
      },
    },
    results: {
      totalRequests: networkCapture.getTotalRequestsCount(),
      totalResponses: networkCapture.getResponseCount(),
      keptResponses: networkCapture.getKeptResponseCount(),
      filteredResponses: networkCapture.getFilteredResponseCount(),
      summary: networkCapture.getSummary(),
    },
    filters: {
      applied: config.filterRules,
      explanation: 'Responses captured and filtered according to configured rules',
    },
    errors:
      errors.length > 0
        ? errors
        : [
            {
              message: 'No errors',
              timestamp: now,
            },
          ],
    metadata: {
      generatedBy: 'pump-automation',
      version: '1.0.0',
    },
  };
}

function generateMetadata(sessionId, config, capturedResponses) {
  const responseMetadata = capturedResponses.map((response, index) => ({
    index,
    filename: response.filename || null,
    url: response.url,
    method: response.method,
    status: response.status,
    contentType: response.contentType,
    context: response.context,
    timestamp: response.timestamp,
    hasBody: Boolean(response.body),
    keptByFilters: response.keptByFilters !== false,
    filterExplanation: response.filterExplanation,
    searchText: buildResponseSearchText(response),
  }));

  return {
    sessionId,
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      scrollSelector: config.scrollSelector,
    },
    responses: responseMetadata,
    totalCaptured: responseMetadata.length,
  };
}

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
      logger.debug('Failed to stringify response body for search index', {
        error: err.message,
      });
    }
  }

  return parts
    .filter(Boolean)
    .join('\n')
    .slice(0, SEARCH_TEXT_LIMIT);
}

export default {
  generateSessionSummary,
  generateMetadata,
};
