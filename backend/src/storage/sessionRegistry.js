import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sessionsRoot = join(__dirname, '../../data/sessions');
const registryPath = join(sessionsRoot, 'index.json');

function ensureRegistry() {
  if (!existsSync(sessionsRoot)) {
    mkdirSync(sessionsRoot, { recursive: true });
  }

  if (!existsSync(registryPath)) {
    writeFileSync(registryPath, JSON.stringify({ sessions: {} }, null, 2), 'utf-8');
  }
}

function readRegistry() {
  ensureRegistry();
  try {
    return JSON.parse(readFileSync(registryPath, 'utf-8'));
  } catch (err) {
    return { sessions: {} };
  }
}

function writeRegistry(registry) {
  ensureRegistry();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

function upsertSession(sessionId, data) {
  const registry = readRegistry();
  const current = registry.sessions[sessionId] || {};
  registry.sessions[sessionId] = {
    ...current,
    ...data,
    sessionId,
    updatedAt: new Date().toISOString(),
  };
  writeRegistry(registry);
  return registry.sessions[sessionId];
}

function getSession(sessionId) {
  const registry = readRegistry();
  return registry.sessions[sessionId] || null;
}

function listSessions(limit = 20) {
  const registry = readRegistry();
  return Object.values(registry.sessions)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, limit);
}

function getDefaultSessionsRoot() {
  ensureRegistry();
  return sessionsRoot;
}

export default {
  upsertSession,
  getSession,
  listSessions,
  getDefaultSessionsRoot,
};
