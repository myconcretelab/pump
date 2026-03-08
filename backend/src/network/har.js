function generateHAREntry(response) {
  return {
    startedDateTime: response.timestamp,
    time: 0, // Will be calculated if needed
    request: {
      method: response.method,
      url: response.url,
      httpVersion: 'HTTP/1.1',
      headers: Object.entries(response.requestHeaders || {}).map(([name, value]) => ({
        name,
        value: String(value),
      })),
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: response.status,
      statusText: getStatusText(response.status),
      httpVersion: 'HTTP/1.1',
      headers: Object.entries(response.headers || {}).map(([name, value]) => ({
        name,
        value: String(value),
      })),
      cookies: [],
      content: {
        size: 0,
        mimeType: response.contentType || 'application/octet-stream',
        text: response.body ? JSON.stringify(response.body) : '',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: {
      wait: 0,
      receive: 0,
      send: 0,
    },
  };
}

function getStatusText(status) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || 'Unknown';
}

function generateHAR(responses, metadata) {
  const har = {
    log: {
      version: '1.2.0',
      creator: {
        name: 'pump-automation',
        version: '1.0.0',
      },
      entries: responses.map(generateHAREntry),
    },
  };

  if (metadata) {
    har.log.comment = `Session: ${metadata.sessionId} | Duration: ${metadata.duration}ms`;
  }

  return har;
}

export default {
  generateHAR,
  generateHAREntry,
};
