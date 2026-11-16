import { crc32, inflateRawSync } from 'node:zlib';
import { ProviderPluginManifestSchema, type ProviderPluginManifest } from '@deck/shared';

const LIMIT = 8 << 20;
export interface PluginArchive {
  manifest: ProviderPluginManifest;
  files: Map<string, Buffer>;
}

/** Inspect a ZIP before any code is written or executed. Only bounded, regular, relative files. */
export function inspectPluginArchive(data: Buffer): PluginArchive {
  if (data.length > LIMIT) throw new Error('Plugin package exceeds 8 MB');
  let end = data.length - 22;
  while (end >= Math.max(0, data.length - 65_557) && data.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || data.readUInt32LE(end) !== 0x06054b50) throw new Error('Invalid ZIP package');
  if (data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6))
    throw new Error('Multi-disk ZIP is not supported');
  const count = data.readUInt16LE(end + 10);
  if (count > 3000) throw new Error('Too many plugin files');
  let cursor = data.readUInt32LE(end + 16);
  let total = 0;
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('Invalid ZIP directory');
    const flags = data.readUInt16LE(cursor + 8);
    const method = data.readUInt16LE(cursor + 10);
    const size = data.readUInt32LE(cursor + 24);
    const compressed = data.readUInt32LE(cursor + 20);
    const nameLength = data.readUInt16LE(cursor + 28);
    const name = data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (
      !name ||
      /[\\:]/.test(name) ||
      name.includes(String.fromCharCode(0)) ||
      name.startsWith('/') ||
      name
        .split('/')
        .some(
          (part) =>
            part === '..' ||
            part === '.' ||
            /[. ]$/.test(part) ||
            part.toLowerCase() === 'node_modules',
        )
    )
      throw new Error('Unsafe plugin path');
    if (((data.readUInt32LE(cursor + 38) >>> 16) & 0xf000) === 0xa000)
      throw new Error('Plugin symlinks are not allowed');
    if (flags & 1 || ![0, 8].includes(method)) throw new Error('Unsupported ZIP encoding');
    const local = data.readUInt32LE(cursor + 42);
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50)
      throw new Error('Invalid ZIP entry');
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    if (start + compressed > data.length || size > LIMIT || (total += size) > LIMIT)
      throw new Error('Plugin contents exceed limits');
    const packed = data.subarray(start, start + compressed);
    const contents = method === 8 ? inflateRawSync(packed, { maxOutputLength: LIMIT }) : packed;
    if (contents.length !== size || crc32(contents) !== data.readUInt32LE(cursor + 16))
      throw new Error('Corrupt plugin file');
    if (!name.endsWith('/')) {
      if (files.has(name)) throw new Error('Duplicate plugin file');
      files.set(name, contents);
    }
    cursor += 46 + nameLength + data.readUInt16LE(cursor + 30) + data.readUInt16LE(cursor + 32);
  }
  const manifestData = files.get('manifest.json');
  if (!manifestData) throw new Error('Plugin package has no manifest.json');
  const manifest = ProviderPluginManifestSchema.parse(JSON.parse(manifestData.toString('utf8')));
  if (!files.has(manifest.entry)) throw new Error('Plugin entry is missing from the package');
  return { manifest, files };
}
