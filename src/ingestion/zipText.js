// Minimal, dependency-free reader for the header/footer parts of a .docx (mammoth does not read them).
// A .docx is a zip file. Names live uncompressed in the central directory, so we can list them without
// inflating anything, then inflate only the small XML parts we need (DecompressionStream, Node 18+ and
// current browsers). Everything is capped so a crafted file cannot make us allocate without limit.
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function listZipEntries(bytes) {
  const min = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const entries = [];
  for (let i = 0; i < count && p + 46 <= bytes.length && u32(bytes, p) === 0x02014b50; i++) {
    const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: u16(bytes, p + 10), compSize: u32(bytes, p + 20), size: u32(bytes, p + 24), offset: u32(bytes, p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function readZipEntry(bytes, entry) {
  if (entry.size > MAX_ENTRY_BYTES) throw new Error('entry too large');
  const o = entry.offset;
  if (u32(bytes, o) !== 0x04034b50) throw new Error('bad local header');
  const start = o + 30 + u16(bytes, o + 26) + u16(bytes, o + 28);
  const data = bytes.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error('unsupported compression');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.length > MAX_ENTRY_BYTES) throw new Error('entry too large');
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function wordXmlToText(xml) {
  return xml
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, '$1\u0001')
    .replace(/<[^>]+>/g, '')
    .replace(/\u0001/g, '')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e]);
}

// Returns { found: boolean, header: string, footer: string, failed: boolean }.
// found = the file has header/footer parts; failed = it has them but they could not be read.
export async function readDocxHeaderFooter(bytes) {
  let entries;
  try { entries = listZipEntries(bytes); } catch { return { found: false, header: '', footer: '', failed: false }; }
  const parts = entries.filter(e => /^word\/(header|footer)\d*\.xml$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (!parts.length) return { found: false, header: '', footer: '', failed: false };
  const seen = new Set();
  const collect = async (kind) => {
    const lines = [];
    for (const e of parts.filter(p => p.name.includes(`/${kind}`))) {
      const text = wordXmlToText(new TextDecoder().decode(await readZipEntry(bytes, e)));
      for (const l of text.split('\n').map(x => x.trim()).filter(Boolean)) if (!seen.has(l)) { seen.add(l); lines.push(l); }
    }
    return lines.join('\n');
  };
  try { return { found: true, header: await collect('header'), footer: await collect('footer'), failed: false }; }
  catch { return { found: true, header: '', footer: '', failed: true }; }
}
