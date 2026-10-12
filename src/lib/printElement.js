// Prints one element through the browser's own print dialog ("Save as PDF").
// Unlike html2pdf.js, which draws the page to an image, this keeps the text as text,
// so the PDF can be read by an ATS (and by our own reader).

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildPrintDocument(markup, title) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* The templates carry their own print rules (position: fixed), which would show only the first page. */
  .resume-preview.resume-preview { position: static !important; left: auto !important; top: auto !important; width: 100% !important; box-shadow: none !important; transform: none !important; }
</style></head><body>${markup}</body></html>`;
}

// Resolves true once the print dialog was opened, false when there was nothing to print.
export function printElement(el, { title = 'resume', print, cleanupMs = 60000 } = {}) {
  if (!el || !el.textContent?.trim()) return Promise.resolve(false);
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    win.document.open();
    win.document.write(buildPrintDocument(el.innerHTML, title));
    win.document.close();
    const run = () => {
      // Browsers name the saved file after the page title; the iframe's title is not always used.
      const savedTitle = document.title;
      document.title = title;
      try { (print || ((w) => { w.focus(); w.print(); }))(win); } finally { document.title = savedTitle; }
      resolve(true);
      setTimeout(() => frame.remove(), cleanupMs);
    };
    // Let layout and fonts settle before the dialog opens.
    setTimeout(run, 100);
  });
}
