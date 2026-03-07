import logger from '../logger.js';

function evaluateRule(rule, request, response) {
  const { type, pattern, negate } = rule;
  let result = false;

  try {
    switch (type) {
      case 'url-contains':
        result = request.url.includes(pattern);
        break;

      case 'url-starts-with':
        result = request.url.startsWith(pattern);
        break;

      case 'method':
        result = request.method === pattern.toUpperCase();
        break;

      case 'content-type':
        const contentType = response.headers['content-type'] || '';
        result = contentType.includes(pattern);
        break;

      case 'status-code':
        result = response.status === parseInt(pattern);
        break;

      case 'status-range':
        const [minStatus, maxStatus] = pattern.split('-').map(Number);
        result = response.status >= minStatus && response.status <= maxStatus;
        break;

      case 'response-contains':
        if (typeof response.body === 'string') {
          result = response.body.includes(pattern);
        } else if (response.body !== null && response.body !== undefined) {
          result = JSON.stringify(response.body).includes(pattern);
        } else {
          result = false;
        }
        break;

      case 'json-only':
        const ct = response.headers['content-type'] || '';
        result = ct.includes('application/json');
        break;

      case 'exclude-assets':
        // Exclude common static assets
        const url = request.url.toLowerCase();
        result =
          !url.includes('.png') &&
          !url.includes('.jpg') &&
          !url.includes('.gif') &&
          !url.includes('.svg') &&
          !url.includes('.webp') &&
          !url.includes('.css') &&
          !url.includes('.woff') &&
          !url.includes('.ttf') &&
          !url.includes('.eot') &&
          !url.includes('.otf');
        break;

      case 'exclude-tracking':
        // Exclude tracking and analytics services
        const trackingDomains = [
          'google-analytics',
          'analytics',
          'doubleclick',
          'facebook.com/tr',
          'hotjar',
          'amplitude',
        ];
        const trackingUrl = request.url.toLowerCase();
        result = !trackingDomains.some((domain) => trackingUrl.includes(domain));
        break;

      default:
        logger.warn(`Unknown filter rule type: ${type}`);
        result = false;
    }
  } catch (err) {
    logger.warn(`Error evaluating rule ${type}`, { error: err.message });
    result = false;
  }

  return negate ? !result : result;
}

function shouldKeepResponse(request, response, filters) {
  if (!filters || (!filters.inclusive?.length && !filters.exclusive?.length)) {
    return true; // Keep all if no filters
  }

  const { inclusive = [], exclusive = [] } = filters;

  // If no inclusive rules, allow by default (unless exclusive matches)
  let shouldInclude = inclusive.length === 0;

  // Check inclusive rules (must match at least one if any exist)
  if (inclusive.length > 0) {
    shouldInclude = inclusive.some((rule) => evaluateRule(rule, request, response));
  }

  // Check exclusive rules (must not match any)
  if (shouldInclude && exclusive.length > 0) {
    const isExcluded = exclusive.some((rule) => evaluateRule(rule, request, response));
    shouldInclude = !isExcluded;
  }

  return shouldInclude;
}

function getFilterExplanation(request, response, filters) {
  const explanations = [];

  if (!filters || (!filters.inclusive?.length && !filters.exclusive?.length)) {
    return 'No filters applied, keeping all responses';
  }

  const { inclusive = [], exclusive = [] } = filters;

  if (inclusive.length > 0) {
    const matchedInclusive = inclusive.filter((rule) =>
      evaluateRule(rule, request, response)
    );
    if (matchedInclusive.length > 0) {
      explanations.push(`Matched ${matchedInclusive.length} inclusive rule(s)`);
    } else {
      explanations.push('Did not match any inclusive rules');
    }
  }

  if (exclusive.length > 0) {
    const matchedExclusive = exclusive.filter((rule) =>
      evaluateRule(rule, request, response)
    );
    if (matchedExclusive.length > 0) {
      explanations.push(`Matched ${matchedExclusive.length} exclusive rule(s) - EXCLUDED`);
    } else {
      explanations.push('Did not match any exclusive rules');
    }
  }

  return explanations.join(' | ');
}

export default {
  shouldKeepResponse,
  getFilterExplanation,
  evaluateRule,
};
