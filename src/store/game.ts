// Game and finance state. Loads from the database at launch and writes through to
// it on every change; the UI reads from here.

import { create } from 'zustand';

import { Db } from '@/data/db';
import { openDb } from '@/data/open';
import { clearBudgets, getLimit, setLimit as saveLimit } from '@/data/repositories/budgets';
import {
  clearEntries,
  deleteEntry as removeEntry,
  deleteExamples,
  EntryEdit,
  insertEntry,
  listEntries,
  StoredEntry,
  updateEntry,
} from '@/data/repositories/entries';
import { categoryForMerchant, learnMerchant } from '@/data/repositories/merchants';
import { getSettings, updateSettings } from '@/data/repositories/settings';
import { Entry, toDateKey, toMonthKey } from '@/domain/entries';
import { Currency } from '@/domain/money';
import { QuickAdd } from '@/domain/quickAdd';
import { Heat } from '@/domain/reaction/dialogue';
import { NewEntry, planReaction, Reaction } from '@/domain/reaction/react';

export type { StoredEntry };

export type ReplyRecord = { tag: string; category: string; amountMinor: number; at: number };

/** First-run budget until onboarding asks for one (M7). */
const DEFAULT_LIMIT = 200000;

export type LogInput = NewEntry & { date?: string };

type GameState = {
  ready: boolean;
  entries: StoredEntry[];
  limitMinor: number | null;
  heat: Heat;
  currency: Currency;
  lastCategory: string;
  recentLineIds: string[];
  replies: ReplyRecord[];
  /** A pre-filled receipt waiting to be opened (from a quick-add link). */
  prefill: QuickAdd | null;

  init(): Promise<void>;
  logEntry(input: LogInput, now?: Date): { entry: StoredEntry; reaction: Reaction };
  editEntry(id: string, edit: EntryEdit): void;
  deleteEntry(id: string): void;
  removeExamples(): void;
  recordReply(tag: string, entry: Entry): void;
  setHeat(heat: Heat): void;
  setLimit(limitMinor: number): void;
  setPrefill(q: QuickAdd | null): Promise<void>;
  /** Replaces this month with example entries so the next small treat goes over budget. */
  loadNearlyBrokeDemo(now?: Date): void;
  reset(): Promise<void>;
};

let db: Db | null = null;
let loading: Promise<void> | null = null;

/** Database writes run in order, in the background; failures are logged, not thrown. */
let queue: Promise<unknown> = Promise.resolve();
function write(task: (db: Db) => Promise<unknown>) {
  queue = queue
    .then(() => (db ? task(db) : undefined))
    .catch((e) => console.warn('[vinnie] database write failed', e));
}

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

export const useGame = create<GameState>()((set, get) => ({
  ready: false,
  entries: [],
  limitMinor: null,
  heat: 'classic',
  currency: 'USD',
  lastCategory: 'coffee',
  recentLineIds: [],
  replies: [],
  prefill: null,

  init() {
    // Safe to call from several places (root layout, quick-add route): loads once.
    loading ??= (async () => {
      db = await openDb();
      const now = new Date();
      const settings = await getSettings(db, now.getTime());
      let limit = await getLimit(db, toMonthKey(now));
      if (limit === null) {
        limit = DEFAULT_LIMIT;
        await saveLimit(db, toMonthKey(now), limit);
      }
      set({
        ready: true,
        entries: await listEntries(db),
        limitMinor: limit,
        heat: settings.heat,
        currency: settings.currency,
        lastCategory: settings.lastCategory,
      });
    })();
    return loading;
  },

  logEntry(input, now = new Date()) {
    const s = get();
    const date = input.date ?? toDateKey(now);
    const reaction = planReaction(input, {
      entries: s.entries,
      limitMinor: s.limitMinor,
      heat: s.heat,
      currency: s.currency,
      recentLineIds: s.recentLineIds,
      now,
      rand: Math.random,
    });
    const entry: StoredEntry = {
      id: newId(),
      type: input.type,
      amountMinor: input.amountMinor,
      category: input.category,
      description: input.description,
      date,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      isExample: false,
      tier: reaction.tier,
    };
    set({
      entries: [...s.entries, entry],
      recentLineIds: [...s.recentLineIds, reaction.lineId].slice(-50),
      lastCategory: input.type === 'saved' ? s.lastCategory : input.category,
    });
    write(async (d) => {
      await insertEntry(d, entry);
      if (input.type !== 'saved') await updateSettings(d, { lastCategory: input.category });
      if (input.description)
        await learnMerchant(d, input.description, input.category, entry.createdAt);
    });
    return { entry, reaction };
  },

  editEntry(id, edit) {
    const now = Date.now();
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...edit, updatedAt: now } : e)),
    }));
    write(async (d) => {
      await updateEntry(d, id, edit, now);
      // Edits are the strongest signal for which category a merchant belongs to.
      if (edit.description) await learnMerchant(d, edit.description, edit.category, now);
    });
  },

  deleteEntry(id) {
    const now = Date.now();
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    write((d) => removeEntry(d, id, now));
  },

  removeExamples() {
    const now = Date.now();
    set((s) => ({ entries: s.entries.filter((e) => !e.isExample) }));
    write((d) => deleteExamples(d, now));
  },

  recordReply(tag, entry) {
    set((s) => ({
      replies: [
        ...s.replies,
        { tag, category: entry.category, amountMinor: entry.amountMinor, at: Date.now() },
      ],
    }));
  },

  setHeat(heat) {
    set({ heat });
    write((d) => updateSettings(d, { heat }));
  },

  setLimit(limitMinor) {
    set({ limitMinor });
    write((d) => saveLimit(d, toMonthKey(new Date()), limitMinor));
  },

  async setPrefill(q) {
    if (q && q.merchant && !q.category && db) {
      const learned = await categoryForMerchant(db, q.merchant);
      if (learned) q = { ...q, category: learned };
    }
    set({ prefill: q });
  },

  loadNearlyBrokeDemo(now = new Date()) {
    const month = toMonthKey(now);
    // Spread over the 1st so nothing counts as a repeat in the last 48 hours.
    const demo: StoredEntry[] = DEMO.map(([category, amountMinor, description], i) => {
      const at = new Date(now.getFullYear(), now.getMonth(), 1, 10 + i).getTime();
      return {
        id: newId(),
        type: 'expense',
        amountMinor,
        category,
        description,
        date: `${month}-01`,
        createdAt: at,
        updatedAt: at,
        isExample: true,
        tier: null,
      };
    });
    const others = get().entries.filter((e) => toMonthKey(e.date) !== month);
    const removed = get().entries.filter((e) => toMonthKey(e.date) === month);
    set({ entries: [...others, ...demo], limitMinor: DEFAULT_LIMIT });
    const t = now.getTime();
    write(async (d) => {
      await d.transaction(async () => {
        for (const e of removed) await removeEntry(d, e.id, t);
        for (const e of demo) await insertEntry(d, e);
        await saveLimit(d, month, DEFAULT_LIMIT);
      });
    });
  },

  async reset() {
    const month = toMonthKey(new Date());
    set({ entries: [], limitMinor: DEFAULT_LIMIT, recentLineIds: [], replies: [] });
    write(async (d) => {
      await clearEntries(d);
      await clearBudgets(d);
      await saveLimit(d, month, DEFAULT_LIMIT);
    });
    await queue;
  },
}));
