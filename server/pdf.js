// PDF → plain text for the inbox. The text is what the analyzer reads and what quotes are checked against;
// the original file is kept next to it so the knowledge base can show the document itself.
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 400;
const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
const assets = (dir) => pathToFileURL(path.join(pkgDir, dir) + path.sep).href;
let pdfjs;
const load = async () => (pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs'));

const fail = (key) => Object.assign(new Error(key), { status: 400 });
export const isPdf = (buf) => Buffer.isBuffer(buf) && buf.subarray(0, 1024).includes('%PDF-');

// Lines are rebuilt from text items by their vertical position; pages are separated by a "[p. N]" marker,
// which the analyzer uses as the evidence location.
export async function pdfToText(buf) {
  if (!isPdf(buf)) throw fail('The file is not a PDF.');
  const { getDocument } = await load();
  let task, doc;
  try {
    task = getDocument({
      data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0,
      standardFontDataUrl: assets('standard_fonts'), cMapUrl: assets('cmaps'), cMapPacked: true,
    });
    doc = await task.promise;
  } catch (e) {
    await task?.destroy();
    throw fail(e?.name === 'PasswordException' ? 'The PDF is password-protected.' : 'Couldn’t read the PDF.');
  }
  try {
    const pages = [];
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      const lines = [];
      let line = '', y = null;
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        const iy = Math.round(it.transform?.[5] ?? 0);
        if (y !== null && Math.abs(iy - y) > 2 && line.trim()) { lines.push(line.trim()); line = ''; }
        line += it.str + (it.hasEOL ? '\n' : '');
        y = iy;
      }
      if (line.trim()) lines.push(line.trim());
      const text = lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text) pages.push(`[p. ${n}]\n${text}`);
      page.cleanup();
    }
    const text = pages.join('\n\n');
    if (text.replace(/\[p\. \d+\]/g, '').replace(/\s/g, '').length < 20) throw fail('The PDF has no text layer (it may be a scan). Run OCR on it first.');
    return { text, pages: doc.numPages };
  } finally { await task.destroy(); }
}
