import { describe, expect, it } from '@jest/globals';

import { EVENTS, sanitizeEvent } from '../analytics';
import { Entry } from '../entries';
import { csvField, entriesToCsv, fullExport, minorToDecimal } from '../exportData';

const e = (over: Partial<Entry & { isExample: boolean }>): Entry & { isExample: boolean } => ({
  id: 'x',
  type: 'expense',
  amountMinor: 650,
  category: 'coffee',
  description: 'Latte',
  date: '2026-11-02',
  createdAt: 1,
  isExample: false,
  ...over,
});

describe('export (blueprint 8.2)', () => {
  it('writes cents as exact decimals', () => {
    expect([5, 650, 120000, 0, -250].map(minorToDecimal)).toEqual([
      '0.05',
      '6.50',
      '1200.00',
      '0.00',
      '-2.50',
    ]);
  });

  it('quotes CSV fields that need it', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('Joe\'s, "best" pizza')).toBe('"Joe\'s, ""best"" pizza"');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });

  it('exports real entries in date order, leaving out examples', () => {
    const csv = entriesToCsv([
      e({ date: '2026-11-03', description: 'Bagel, plain', amountMinor: 400 }),
      e({ date: '2026-11-01' }),
      e({ date: '2026-11-02', isExample: true, description: 'Example' }),
    ]);
    expect(csv.split('\r\n')).toEqual([
      'date,type,amount,currency,category,description',
      '2026-11-01,expense,6.50,USD,Coffee,Latte',
      '2026-11-03,expense,4.00,USD,Coffee,"Bagel, plain"',
      '',
    ]);
  });

  it('wraps everything in a versioned JSON document', () => {
    const json = JSON.parse(fullExport({ entries: [1, 2] }, new Date('2026-11-02T10:00:00Z')));
    expect(json).toEqual({
      app: 'vinnie',
      version: 1,
      exportedAt: '2026-11-02T10:00:00.000Z',
      entries: [1, 2],
    });
  });
});

describe('analytics (blueprint 8.4)', () => {
  it('drops anything financial', () => {
    const r = sanitizeEvent('entry_logged', {
      type: 'expense',
      via: 'chip',
      amount: 650,
      description: 'Latte',
      merchant: 'Starbucks',
    });
    expect(r).toEqual({ event: 'entry_logged', props: { type: 'expense', via: 'chip' } });
  });

  it('drops values outside the allowed list', () => {
    expect(sanitizeEvent('reaction_shown', { tier: '$650' })?.props).toEqual({});
    expect(sanitizeEvent('made_up_event', {})).toBeNull();
  });

  it('never allows a numeric or free-text property anywhere', () => {
    for (const props of Object.values(EVENTS)) {
      for (const values of Object.values(props) as readonly string[][]) {
        for (const v of values) expect(v).toMatch(/^[a-z_0-9]+$/);
      }
    }
  });
});
