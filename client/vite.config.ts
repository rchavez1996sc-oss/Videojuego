import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** `virtual:asset-hashes`: a short content hash per file under public/assets, so each asset's URL changes only when that file does (a manifest bump no longer re-downloads everything). */
function assetHashes(): Plugin {
  const id = 'virtual:asset-hashes', root = join(__dirname, 'public', 'assets');
  const walk = (dir: string, out: Record<string, string>) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p, out);
      else out[relative(root, p).split('\\').join('/')] = createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 10);
    }
    return out;
  };
  return {
    name: 'asset-hashes',
    resolveId: (i) => (i === id ? `\0${id}` : undefined),
    load: (i) => (i === `\0${id}` ? `export default ${JSON.stringify(walk(root, {}))};` : undefined),
  };
}

export default defineConfig({
  base: './',
  plugins: [assetHashes()],
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
