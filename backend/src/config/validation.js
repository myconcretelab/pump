function validateConfig(config) {
  const errors = [];

  if (!config.baseUrl || typeof config.baseUrl !== 'string') {
    errors.push('baseUrl is required and must be a string');
  }

  if (config.baseUrl && !isValidURL(config.baseUrl)) {
    errors.push('baseUrl must be a valid URL');
  }

  if (!config.scrollSelector || typeof config.scrollSelector !== 'string') {
    errors.push('scrollSelector is required and must be a string');
  }

  if (!Number.isInteger(config.scrollCount) || config.scrollCount < 1) {
    errors.push('scrollCount must be a positive integer');
  }

  if (!Number.isInteger(config.scrollDistance) || config.scrollDistance < 1) {
    errors.push('scrollDistance must be a positive integer');
  }

  if (!Number.isInteger(config.scrollDelay) || config.scrollDelay < 0) {
    errors.push('scrollDelay must be a non-negative integer');
  }

  if (!Number.isInteger(config.waitBeforeScroll) || config.waitBeforeScroll < 0) {
    errors.push('waitBeforeScroll must be a non-negative integer');
  }

  if (config.outputFolder && typeof config.outputFolder !== 'string') {
    errors.push('outputFolder must be a string');
  }

  if (typeof config.persistSession !== 'boolean') {
    errors.push('persistSession must be a boolean');
  }

  if (typeof config.manualScrollMode !== 'boolean') {
    errors.push('manualScrollMode must be a boolean');
  }

  if (!Number.isInteger(config.manualScrollDuration) || config.manualScrollDuration < 0) {
    errors.push('manualScrollDuration must be a non-negative integer');
  }

  if (!Array.isArray(config.filterRules?.inclusive)) {
    errors.push('filterRules.inclusive must be an array');
  }

  if (!Array.isArray(config.filterRules?.exclusive)) {
    errors.push('filterRules.exclusive must be an array');
  }

  if (!config.advancedSelectors || typeof config.advancedSelectors !== 'object') {
    errors.push('advancedSelectors must be an object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export default {
  validateConfig,
  isValidURL,
};
