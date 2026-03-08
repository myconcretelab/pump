import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const backendSrcRoot = join(projectRoot, 'backend', 'src');

function collectJavaScriptFiles(currentDir) {
  return readdirSync(currentDir).flatMap((entry) => {
    const fullPath = join(currentDir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectJavaScriptFiles(fullPath);
    }

    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

const files = collectJavaScriptFiles(backendSrcRoot);

if (files.length === 0) {
  console.error('No backend source files found to validate.');
  process.exit(1);
}

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Validated backend syntax for ${files.length} files.`);
