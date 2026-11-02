// In-memory game state for the M1 hook prototype. Persistence (SQLite) comes in M2.

import { create } from 'zustand';

import { Entry, toDateKey } from '@/domain/entries';
import { Currency } from '@/domain/money';
import { Heat } from '@/domain/reaction/dialogue';
import { NewEntry, planReaction, Reaction } from '@/domain/reaction/react';
import { Tier } from '@/domain/reaction/tier';

export type LoggedEntry = Entry & { tier: Tier };

export type ReplyRecord = { tag: string; category: string; amountMinor: number; at: number };

type GameState = {
  entries: LoggedEntry[];
  limitMinor: number | null;
  heat: Heat;
  currency: Currency;
  recentLineIds: string[];
  replies: ReplyRecord[];
  logEntry(input: NewEntry, now?: Date): { entry: LoggedEntry; reaction: Reaction };
  recordReply(tag: string, entry: Entry): void;
  setHeat(heat: Heat): void;
  setLimit(limitMinor: number | null): void;
  /** Fills the month so the next small treat goes over budget. */
  loadNearlyBrokeDemo(now?: Date): void;
  reset(): void;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DEMO: [string, number, string][] = [
  ['bills', 125000, 'Rent'],
  ['groceries', 31240, 'Weekly shop'],
  ['transport', 12700, 'Monthly pass'],
  ['dining', 8400, 'Birthday dinner'],
  ['delivery', 6230, 'Pizza'],
  ['subscriptions', 4497, 'Streaming x3'],
  ['coffee', 3900, 'Cold brew'],
  ['shopping', 7533, 'Sneakers'],
];

const initial = {
  entries: [] as LoggedEntry[],
  limitMinor: 200000 as number | null,
  heat: 'classic' as Heat,
  currency: 'USD' as Currency,
  recentLineIds: [] as string[],
  replies: [] as ReplyRecord[],
};

export const useGame = create<GameState>()((set, get) => ({
  ...initial,

  logEntry(input, now = new Date()) {
    const s = get();
    const reaction = planReaction(input, {
      entries: s.entries,
      limitMinor: s.limitMinor,
      heat: s.heat,
      currency: s.currency,
      recentLineIds: s.recentLineIds,
      now,
      rand: Math.random,
    });
    const entry: LoggedEntry = {
      id: newId(),
      ...input,
      date: toDateKey(now),
      createdAt: now.getTime(),
      tier: reaction.tier,
    };
    set({
      entries: [...s.entries, entry],
      recentLineIds: [...s.recentLineIds, reaction.lineId].slice(-50),
    });
    return { entry, reaction };
  },

  recordReply(tag, entry) {
    set((s) => ({
      replies: [
        ...s.replies,
        { tag, category: entry.category, amountMinor: entry.amountMinor, at: Date.now() },
      ],
    }));
  },

  setHeat: (heat) => set({ heat }),
  setLimit: (limitMinor) => set({ limitMinor }),

  loadNearlyBrokeDemo(now = new Date()) {
    // Spread over earlier days so nothing counts as a repeat in the last 48 hours.
    const entries: LoggedEntry[] = DEMO.map(([category, amountMinor, description], i) => {
      const at = new Date(now.getFullYear(), now.getMonth(), 1, 10 + i);
      return {
        id: newId(),
        type: 'expense',
        amountMinor,
        category,
        description,
        date: toDateKey(at),
        createdAt: at.getTime(),
        tier: 'neutral',
      };
    });
    set({ entries, limitMinor: 200000 });
  },

  reset: () => set({ ...initial }),
}));
