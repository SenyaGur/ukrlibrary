/**
 * Client-side printing helpers.
 *
 * Opens a clean, self-contained document in a new window and triggers the
 * browser's print dialog. The user can print to paper or "Save as PDF" from
 * there — no server-side PDF generation needed. Used for issue receipts and
 * reader reports.
 */

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 32px 40px;
    line-height: 1.5;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .muted { color: #666; font-size: 13px; }
  .header {
    display: flex; align-items: baseline; justify-content: space-between;
    border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px;
  }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f4f4f5; font-weight: 600; }
  .overdue { color: #b91c1c; font-weight: 600; }
  .footer { margin-top: 28px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
  @media print {
    body { padding: 0; }
    @page { margin: 16mm; }
  }
`;

/**
 * Render an HTML fragment as a standalone printable document and open the
 * print dialog. `title` becomes the document title (and default PDF filename).
 */
export function printHtml(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=820,height=640');
  if (!win) {
    // Popup blocked — surface via the calling code's own error handling.
    throw new Error('popup-blocked');
  }
  win.document.write(
    `<!doctype html><html lang="uk"><head><meta charset="utf-8">` +
      `<title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head>` +
      `<body>${bodyHtml}</body></html>`,
  );
  win.document.close();
  win.focus();

  const triggerPrint = () => {
    try {
      win.print();
    } catch {
      /* ignore */
    }
  };
  // Print once content has laid out; onload covers most browsers, the timeout
  // is a fallback for those that fire print before layout settles.
  win.onload = triggerPrint;
  setTimeout(triggerPrint, 400);
}

/** Escape a string for safe interpolation into HTML text/attribute context. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
