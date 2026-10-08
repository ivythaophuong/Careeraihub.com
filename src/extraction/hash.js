// A fast, synchronous, non-cryptographic hash for ResumeFacts.content_hash: it only needs to answer
// "is this the same text as last time" (cache key / identity), not resist tampering. FNV-1a run twice
// with different seeds, concatenated, so two different texts landing on the same 32-bit value is very
// unlikely in practice for resume-sized text.
function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function contentHash(text) {
  const t = String(text || '');
  return `fnv1a64:${fnv1a(t, 0x811c9dc5)}${fnv1a(t, 0x9e3779b9)}`;
}
