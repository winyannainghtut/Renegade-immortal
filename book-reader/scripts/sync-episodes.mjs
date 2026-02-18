import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const pairs = [
  { from: path.resolve(root, '../eng-episodes'), to: path.resolve(root, 'public/eng-episodes') },
  { from: path.resolve(root, '../burmese-episodes'), to: path.resolve(root, 'public/burmese-episodes') },
];

for (const { from, to } of pairs) {
  await rm(to, { recursive: true, force: true });
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`Synced: ${from} -> ${to}`);
}
