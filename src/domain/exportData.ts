// Export (blueprint §15, 8.2): your data, in formats a spreadsheet or another app
// can read. Amounts are written as plain decimals, never floats.

import { getCategory } from './categories';
import type { Entry } from './entries';

type Exportable = Entry & { isExample?: boolean };

/** Minor units as "12.50" without going through floating point. */
export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Quotes a CSV field when it has a comma, quote or newline (RFC 4180). */
export function csvField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function entriesToCsv(entries: readonly Exportable[], currency = 'USD'): string {
  const header = ['date', 'type', 'amount', 'currency', 'category', 'description'];
  const rows = [...entries]
    .filter((e) => !e.isExample)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((e) =>
      [
        e.date,
        e.type,
        minorToDecimal(e.amountMinor),
        currency,
        getCategory(e.category).label,
        e.description,
      ]
        .map(csvField)
        .join(','),
    );
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export type FullExport = {
  app: 'vinnie';
  version: 1;
  exportedAt: string;
  [section: string]: unknown;
};

export function fullExport(sections: Record<string, unknown>, now: Date): string {
  const data: FullExport = {
    app: 'vinnie',
    version: 1,
    exportedAt: now.toISOString(),
    ...sections,
  };
  return JSON.stringify(data, null, 2);
}
