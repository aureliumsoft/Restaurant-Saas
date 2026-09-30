/** Build a CSV string from header + rows (cells escaped). */
export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const escape = (cell: string | number | null | undefined) => {
    const raw = cell == null ? '' : String(cell);
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Restore UI locks that Radix/print can leave behind. */
function unlockDocumentUi() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.style.removeProperty('pointer-events');
  body.style.removeProperty('overflow');
  body.removeAttribute('data-scroll-locked');
}

/** Print a report via a hidden iframe (avoids popup blockers). */
export function printReportHtml(opts: {
  title: string;
  subtitle?: string;
  kpis?: Array<{ label: string; value: string }>;
  tableHtml: string;
}) {
  if (typeof document === 'undefined') return false;

  unlockDocumentUi();

  const kpiHtml =
    opts.kpis && opts.kpis.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">${opts.kpis
          .map(
            (k) =>
              `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-width:140px;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;">${escapeHtml(k.label)}</div><div style="font-size:18px;font-weight:700;">${escapeHtml(k.value)}</div></div>`
          )
          .join('')}</div>`
      : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#0f172a;padding:24px;}
  h1{font-size:22px;margin:0 0 4px;}
  .sub{color:#64748b;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}
  th{background:#f8fafc;text-transform:uppercase;font-size:10px;letter-spacing:.04em;}
  @media print{body{padding:0;}}
</style></head><body>
  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ''}
  ${kpiHtml}
  ${opts.tableHtml}
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', opts.title);
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return false;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
    unlockDocumentUi();
  };

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;

    const finish = () => {
      frameWindow.removeEventListener('afterprint', finish);
      window.removeEventListener('afterprint', finish);
      cleanup();
    };
    frameWindow.addEventListener('afterprint', finish);
    window.addEventListener('afterprint', finish);

    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      finish();
      return;
    }

    // Fallback if afterprint never fires.
    window.setTimeout(finish, 1500);
  };

  window.setTimeout(triggerPrint, 50);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function rowsToHtmlTable(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((c) => `<td>${escapeHtml(c == null ? '' : String(c))}</td>`)
          .join('')}</tr>`
    )
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">No data</td></tr>`}</tbody></table>`;
}
