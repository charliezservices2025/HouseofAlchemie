/**
 * Splits a document into overlapping chunks that respect paragraph
 * boundaries. Roughly 1,400 characters a chunk (about 350 tokens), with a
 * 200 character overlap so a framework step split across a boundary is still
 * retrievable from either side.
 */
export function chunkText(raw: string, opts: { target?: number; overlap?: number } = {}): string[] {
  const target = opts.target ?? 1400;
  const overlap = opts.overlap ?? 200;

  const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const c = current.trim();
    if (c) chunks.push(c);
  };

  for (const p of paragraphs) {
    if (p.length > target * 1.5) {
      // Very long paragraph: split by sentences.
      const sentences = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [p];
      for (const s of sentences) {
        if ((current + " " + s).length > target && current) {
          push();
          current = current.slice(-overlap) + " " + s;
        } else {
          current += (current ? " " : "") + s.trim();
        }
      }
      continue;
    }
    if ((current + "\n\n" + p).length > target && current) {
      push();
      current = current.slice(-overlap) + "\n\n" + p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  push();
  return chunks;
}

/** Cheap token estimate, adequate for budgeting and reporting. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}
