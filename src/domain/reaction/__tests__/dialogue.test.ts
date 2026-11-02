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
  promiseDay: 'Tuesday',
  today: 'Thursday',
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
  it('has the blueprint M4 minimum of 120 lines', () => {
    expect(LINES.length).toBeGreaterThanOrEqual(120);
  });

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
    expect(line?.categories).toContain('coffee');
    expect(line?.conditions).toContain('repeat');
  });

  it('skips recently shown lines while others fit', () => {
    const first = selectLine(LINES, q({ tier: 'neutral' }), rng(1));
    const second = selectLine(LINES, q({ tier: 'neutral', recent: [first!.id] }), rng(1));
    expect(second?.id).not.toBe(first?.id);
  });

  it('repeats a line rather than saying nothing', () => {
    // Every line that fits a health receipt was just shown.
    const fits = LINES.filter(
      (l) =>
        l.tier === 'approve' &&
        !l.conditions?.length &&
        (!l.categories?.length || l.categories.includes('health')),
    ).map((l) => l.id);
    const again = selectLine(
      LINES,
      q({ tier: 'approve', category: 'health', recent: fits }),
      rng(1),
    );
    expect(fits).toContain(again?.id);
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

describe('tone rules (blueprint §7.6)', () => {
  const BANNED = /\b(fuck|shit|bitch|asshole|bastard|crap)\w*/i;
  it('keeps real profanity out of everything below Unhinged', () => {
    for (const l of LINES.filter((x) => x.minHeat !== 'unhinged')) {
      expect(l.text).not.toMatch(BANNED);
    }
    for (const s of SCRIPTS) {
      for (const t of [...s.lines, s.closer, ...s.replies.map((r) => r.response)]) {
        expect(t).not.toMatch(BANNED);
      }
    }
  });
});
