import { describe, expect, it } from '@jest/globals';

import calls from '@/content/calls.json';
import lines from '@/content/lines.json';
import { rng } from '@/domain/random';

import {
  CallScript,
  fillPlaceholders,
  heatAllows,
  Line,
  LineQuery,
  selectCallScript,
  selectLine,
} from '../dialogue';
import { Reason, TIER_ORDER } from '../tier';

const LINES = lines as Line[];
const SCRIPTS = calls.scripts as CallScript[];
const ALL_VALUES = {
  amount: '$6.50',
  category: 'coffee',
  Category: 'Coffee',
  count: 3,
  monthTotal: '$19.50',
  daysLeft: 9,
  remaining: '$120',
};

const q = (over: Partial<LineQuery>): LineQuery => ({
  tier: 'neutral',
  heat: 'classic',
  category: 'coffee',
  reasons: [],
  recent: [],
  ...over,
});

describe('dialogue content', () => {
  it('has unique line ids', () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
  });

  it('every line and call resolves all its placeholders', () => {
    const texts = [
      ...LINES.map((l) => l.text),
      ...SCRIPTS.flatMap((s) => [
        ...s.lines,
        s.closer,
        ...s.replies.flatMap((r) => [r.text, r.response]),
      ]),
    ];
    for (const t of texts) expect(fillPlaceholders(t, ALL_VALUES)).not.toMatch(/[{}]/);
  });

  it('has a fallback line for every tier at every heat', () => {
    for (const tier of TIER_ORDER) {
      for (const heat of ['gentle', 'classic', 'unhinged'] as const) {
        expect(selectLine(LINES, q({ tier, heat, category: 'other' }), rng(1))).not.toBeNull();
      }
    }
  });

  it('every call script offers exactly 3 replies', () => {
    for (const s of SCRIPTS) expect(s.replies).toHaveLength(3);
  });
});

describe('selectLine', () => {
  it('never picks a line above the user’s heat', () => {
    const rand = rng(3);
    for (let i = 0; i < 200; i++) {
      const tier = TIER_ORDER[i % TIER_ORDER.length];
      const reasons: Reason[] = ['repeatAgain', 'pushedOverBudget', 'alreadyOverBudget'];
      const line = selectLine(LINES, q({ tier, heat: 'gentle', reasons }), rand);
      expect(line && heatAllows('gentle', line.minHeat)).toBe(true);
    }
  });

  it('prefers category- and condition-specific lines', () => {
    const line = selectLine(
      LINES,
      q({ tier: 'judge', category: 'coffee', reasons: ['repeat'] }),
      rng(1),
    );
    expect(line?.id).toBe('ju_coffee_repeat');
  });

  it('skips recently shown lines while others fit', () => {
    const first = selectLine(LINES, q({ tier: 'neutral' }), rng(1));
    const second = selectLine(LINES, q({ tier: 'neutral', recent: [first!.id] }), rng(1));
    expect(second?.id).not.toBe(first?.id);
  });

  it('repeats a line rather than saying nothing', () => {
    // Health has one specific line and one generic approve line; both were just shown.
    const recent = ['ap_health_1', 'ap_generic_1'];
    const again = selectLine(LINES, q({ tier: 'approve', category: 'health', recent }), rng(1));
    expect(again?.id).toBe('ap_health_1');
  });
});

describe('fillPlaceholders', () => {
  it('throws on a missing value', () => {
    expect(() => fillPlaceholders('{nope}', {})).toThrow(/nope/);
  });
});

describe('selectCallScript', () => {
  it('matches the trigger reason', () => {
    expect(selectCallScript(SCRIPTS, ['pushedOverBudget'], 'classic')?.id).toBe('call_over_budget');
    expect(selectCallScript(SCRIPTS, ['alreadyOverBudget', 'big'], 'classic')?.id).toBe(
      'call_already_over',
    );
  });

  it('falls back to the generic script', () => {
    expect(selectCallScript(SCRIPTS, ['repeatAgain'], 'gentle')?.id).toBe('call_generic');
  });
});
