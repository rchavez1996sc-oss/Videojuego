import hashes from 'virtual:asset-hashes';

/** Cache key for an asset path relative to `assets/` (its content hash), so browsers keep every unchanged file. */
export const ver = (path: string): string => (hashes as Record<string, string>)[path.split('?')[0]] ?? '0';
