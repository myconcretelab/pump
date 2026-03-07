import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storageStatesRoot = join(__dirname, '../../data/storageStates');

function ensureStorageStatesRoot() {
  if (!existsSync(storageStatesRoot)) {
    mkdirSync(storageStatesRoot, { recursive: true });
  }
}

function sanitizeSegment(value, fallback = 'default') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildStorageStateId(config = {}) {
  let hostname = 'site';

  if (config.baseUrl) {
    try {
      const parsedUrl = new URL(config.baseUrl);
      hostname = parsedUrl.host || parsedUrl.hostname || hostname;
    } catch (err) {
      // Keep fallback hostname when URL parsing fails.
    }
  }

  const username = sanitizeSegment(config.username, 'anonymous');
  return `${sanitizeSegment(hostname, 'site')}__${username}`;
}

function getStorageStatePath(config = {}) {
  if (config.persistSession === false) {
    return null;
  }

  ensureStorageStatesRoot();
  return join(storageStatesRoot, `${buildStorageStateId(config)}.json`);
}

function hasStorageState(config = {}) {
  const statePath = getStorageStatePath(config);
  return Boolean(statePath && existsSync(statePath));
}

export default {
  getStorageStatePath,
  hasStorageState,
  getStorageStatesRoot: () => {
    ensureStorageStatesRoot();
    return storageStatesRoot;
  },
};
