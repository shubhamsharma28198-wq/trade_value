import { mkdir, cp, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['index.html', 'app.js', 'styles.css', 'reference.css', 'reference-dashboard.js', 'matrix.svg', 'demo.js', 'client.js']) {
  if (!(await readFile(resolve(root, 'public', file), 'utf8')).trim()) throw new Error(`Missing asset: ${file}`);
}
await mkdir(resolve(root, 'dist'), { recursive: true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
console.log('Web assets built successfully.');
