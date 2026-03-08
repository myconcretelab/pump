const API_KEY_STORAGE_KEY = 'pump.apiKey';

function getStoredApiKey() {
  if (typeof window === 'undefined') {
    return '';
  }

  return String(window.localStorage.getItem(API_KEY_STORAGE_KEY) || '').trim();
}

function setStoredApiKey(apiKey) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = String(apiKey || '').trim();
  if (!normalized) {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(API_KEY_STORAGE_KEY, normalized);
}

export {
  API_KEY_STORAGE_KEY,
  getStoredApiKey,
  setStoredApiKey,
};
