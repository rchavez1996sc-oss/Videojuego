import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Per-chapter signature of everything that shapes a level's top-down plan (world code + chapter JSON): a cached minimap is valid only while it matches. */
export function levelSigs(clientDir) {
  const files = [];
  const walk = (d) => readdirSync(d).sort().forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
  walk(join(clientDir, 'src', 'world'));
  const world = createHash('md5');
  for (const f of files) world.update(readFileSync(f));
  const base = world.digest('hex'), dir = join(clientDir, 'src', 'data', 'chapters'), out = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) out[f.slice(0, 4)] = createHash('md5').update(base).update(readFileSync(join(dir, f))).digest('hex').slice(0, 12);
  return out;
}
