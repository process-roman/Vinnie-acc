import { describe, expect, it } from '@jest/globals';

import { Entry, toDateKey } from '../entries';
import {
  FED_UP_TAPS,
  nextTapStreak,
  NO_TAPS,
  pickFedUpLine,
  pickPropLine,
  PropTarget,
  propLinePool,
  TAP_GAP_MS,
} from '../propLines';
import { rng } from '../random';
import { Tier } from '../reaction/tier';
import { plantFor, roomState, trackingStreak, weatherFor } from '../roomState';

const now = new Date(2026, 10, 20, 15);
const HOUR = 3600 * 1000;

const e = (amountMinor: number, over: Partial<Entry & { tier: Tier | null }> = {}) => ({
  id: Math.random().toString(36),
  type: 'expense' as const,
  amountMinor,
  category: 'coffee',
  description: '',
  date: toDateKey(now),
  createdAt: now.getTime() - 5 * HOUR,
  tier: null,
  ...over,
});

describe('plant and weather thresholds (blueprint §3)', () => {
  it.each([
    [0, 'healthy', 'sunny'],
    [0.59, 'healthy', 'sunny'],
    [0.6, 'droopy', 'cloudy'],
    [0.84, 'droopy', 'cloudy'],
    [0.85, 'wilted', 'rain'],
    [1, 'wilted', 'rain'],
    [1.01, 'dead', 'storm'],
  ])('at %p spent', (share, plant, weather) => {
    expect(plantFor(share)).toBe(plant);
    expect(weatherFor(share)).toBe(weather);
  });

  it('is calm with no budget', () => {
    expect(plantFor(null)).toBe('healthy');
    expect(weatherFor(null)).toBe('sunny');
  });
});

describe('roomState', () => {
  it('reflects spending against the budget', () => {
    expect(roomState([e(90000)], 100000, now)).toMatchObject({
      plant: 'wilted',
      weather: 'rain',
      poster: 'intact',
    });
    expect(roomState([e(110000)], 100000, now)).toMatchObject({
      plant: 'dead',
      weather: 'storm',
      poster: 'cracked',
    });
  });

  it('piles one receipt per expense this month, capped', () => {
    const many = Array.from({ length: 30 }, () => e(100));
    expect(roomState([e(100), e(100), e(100, { type: 'saved' })], null, now).receipts).toBe(2);
    expect(roomState(many, null, now).receipts).toBe(14);
    expect(roomState([e(100, { date: '2026-10-31' })], null, now).receipts).toBe(0);
  });

  it('steams the espresso when he is relaxed, and hides the cat when he is angry', () => {
    expect(roomState([], null, now, 60)).toMatchObject({ espressoSteaming: true, cat: 'sitting' });
    expect(roomState([], null, now, 50)).toMatchObject({ espressoSteaming: false });
    expect(roomState([], null, now, 30)).toMatchObject({ espressoSteaming: false, cat: 'hiding' });
  });

  it('puts the cat to sleep on the desk during a tracking streak', () => {
    const yesterday = e(100, { date: '2026-11-19' });
    expect(roomState([e(100), yesterday], null, now).cat).toBe('sleeping');
    expect(roomState([e(100)], null, now).cat).toBe('sitting');
  });
});

describe('trackingStreak', () => {
  const d = (date: string) => ({ date });
  it('counts back from today', () => {
    expect(trackingStreak([d('2026-11-20'), d('2026-11-19'), d('2026-11-18')], now)).toBe(3);
  });
  it('is not broken just because today has no entry yet', () => {
    expect(trackingStreak([d('2026-11-19'), d('2026-11-18')], now)).toBe(2);
  });
  it('stops at a gap', () => {
    expect(trackingStreak([d('2026-11-20'), d('2026-11-18')], now)).toBe(1);
    expect(trackingStreak([d('2026-11-17')], now)).toBe(0);
  });
});

describe('prop lines', () => {
  const room = roomState([], 100000, now);
  const targets: PropTarget[] = [
    'plant',
    'window',
    'cat',
    'phone',
    'espresso',
    'poster',
    'receipts',
    'vinnie',
  ];

  it('has at least 3 lines for every prop in every state', () => {
    const states = [0, 0.7, 0.9, 1.2].map((s) => roomState([e(s * 100000)], 100000, now));
    const upset = roomState([e(100)], 100000, now, 10);
    for (const r of [...states, upset]) {
      for (const t of targets) expect(propLinePool(t, r).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never says the same line twice in a row', () => {
    const rand = rng(5);
    for (const t of targets) {
      let last: string | undefined;
      for (let i = 0; i < 30; i++) {
        const line = pickPropLine(t, room, last, rand);
        expect(line).not.toBe(last);
        expect(line).not.toMatch(/[{}]/);
        last = line;
      }
    }
  });
});

describe('poking Vinnie', () => {
  const tap = (times: number[]) => times.reduce(nextTapStreak, NO_TAPS).count;

  it('counts quick taps and starts over after a pause', () => {
    const t = 1_000_000;
    expect(tap([t, t + 300, t + 600])).toBe(FED_UP_TAPS);
    expect(tap([t, t + 300, t + 300 + TAP_GAP_MS + 1])).toBe(1);
  });

  it('keeps the real swearing to Unhinged', () => {
    const rand = rng(3);
    for (let i = 0; i < 40; i++) {
      expect(pickFedUpLine('gentle', undefined, rand)).not.toMatch(/vaffanculo|fuck/i);
      expect(pickFedUpLine('classic', undefined, rand)).toMatch(/vaffanapoli/i);
    }
  });

  it('never repeats itself twice running', () => {
    const rand = rng(9);
    let last: string | undefined;
    for (let i = 0; i < 30; i++) {
      const line = pickFedUpLine('unhinged', last, rand);
      expect(line).not.toBe(last);
      last = line;
    }
  });
});
