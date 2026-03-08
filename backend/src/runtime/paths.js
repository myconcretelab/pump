import { join, isAbsolute } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..', '..');

function resolveProjectPath(targetPath, fallbackSegments) {
  if (targetPath && typeof targetPath === 'string') {
    return isAbsolute(targetPath) ? targetPath : join(projectRoot, targetPath);
  }

  return join(projectRoot, ...fallbackSegments);
}

function getProjectRoot() {
  return projectRoot;
}

function getDataRoot() {
  return resolveProjectPath(process.env.DATA_DIR, ['data']);
}

function resolveDataPath(...segments) {
  return join(getDataRoot(), ...segments);
}

function getFrontendDistDir() {
  return resolveProjectPath(process.env.FRONTEND_DIST_DIR, ['frontend', 'dist']);
}

export {
  getProjectRoot,
  getDataRoot,
  resolveDataPath,
  getFrontendDistDir,
};
