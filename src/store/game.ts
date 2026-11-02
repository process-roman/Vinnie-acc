// Game and finance state. Loads from the database at launch and writes through to
// it on every change; the UI reads from here.

import { create } from 'zustand';

import { Db } from '@/data/db';
import { openDb } from '@/data/open';
import { clearBudgets, getLimit, setLimit as saveLimit } from '@/data/repositories/budgets';
import {
  CharacterState,
  getCharacter,
  resetCharacter,
  saveCharacter,
} from '@/data/repositories/character';
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
import { clearLedger, insertLedger, listLedger, resolveLedger } from '@/data/repositories/ledger';
import {
  clearProgression,
  grantCoins,
  listAchievements,
  listCoinTx,
  listInventory,
  saveAchievements,
  saveInventory,
  spendCoins,
} from '@/data/repositories/progression';
import { categoryForMerchant, learnMerchant } from '@/data/repositories/merchants';
import { getSettings, setInstalledAt, updateSettings } from '@/data/repositories/settings';
import {
  Achievement,
  AchievementEvent,
  AchievementState,
  derivedProgress,
  lastMonthUnderControl,
  updateAchievements,
} from '@/domain/achievements';
import { balance, CoinGrant, grantsForEntry, reversalForDeletedEntry } from '@/domain/coins';
import { Entry, toDateKey, toMonthKey } from '@/domain/entries';
import { Currency } from '@/domain/money';
import { clampMood, DECLINE_MOOD, driftMood, MOOD_START, REPLY_MOOD } from '@/domain/mood';
import { QuickAdd } from '@/domain/quickAdd';
import { Heat } from '@/domain/reaction/dialogue';
import { HONEYMOON_MS } from '@/domain/reaction/escalation';
import { keptPromises, LedgerEntry, LedgerEvent } from '@/domain/reaction/ledger';
import { NewEntry, planReaction, Reaction } from '@/domain/reaction/react';
import { crackWorse, repairDue, repairOnce } from '@/domain/repair';
import { canBuy, equip, GIFTS, itemById, Owned } from '@/domain/shop';

export type { CharacterState, StoredEntry };

/** First-run budget until onboarding asks for one (M7). */
const DEFAULT_LIMIT = 200000;
/** Mood boost when he notices you kept a promise for a week. */
const KEPT_PROMISE_MOOD = 6;

export type LogInput = NewEntry & { date?: string };

const FRESH_CHARACTER = (now: number): CharacterState => ({
  mood: MOOD_START,
  moodAt: now,
  crackLevel: 0,
  crackSeed: 1,
  impact: null,
  lastCrackAt: null,
  lastCallAt: null,
  lastRepairDay: null,
});

type GameState = {
  ready: boolean;
  entries: StoredEntry[];
  limitMinor: number | null;
  heat: Heat;
  currency: Currency;
  lastCategory: string;
  recentLineIds: string[];
  /** When the app was first opened; the first three days are a honeymoon. */
  installedAt: number;
  character: CharacterState;
  ledger: LedgerEntry[];
  /** A pre-filled receipt waiting to be opened (from a quick-add link). */
  prefill: QuickAdd | null;
  coinTx: CoinGrant[];
  achievements: AchievementState;
  inventory: Owned[];
  /** Achievement unlocks waiting to be shown, oldest first. */
  toasts: Achievement[];

  /** Counts an achievement event (a call answered, a punch, a gift, a repair...). */
  achievementEvent(ev: AchievementEvent): void;
  dismissToast(): void;
  /** Buys a gift or office item. Returns Vinnie's thank-you line, or null if it can't. */
  buy(id: string): string | null;
  toggleEquip(id: string): void;
  /** Playtests: free coins. */
  grantDebugCoins(n: number): void;

  init(): Promise<void>;
  logEntry(input: LogInput, now?: Date): { entry: StoredEntry; reaction: Reaction };
  editEntry(id: string, edit: EntryEdit): void;
  deleteEntry(id: string): void;
  removeExamples(): void;
  /** A reply on a call: goes in the promise ledger and moves his mood. */
  recordReply(tag: string, entry: Entry): void;
  /** You declined his call. */
  declined(): void;
  /** The glass cracked (or got worse). `impact` is a fraction of the window. */
  crackGlass(impact: { x: number; y: number }): void;
  callPlaced(): void;
  /** Takes the crack down a level if today earned it. Returns true if it did. */
  repairIfDue(now?: Date): boolean;
  /** Playtests: repair right now, ignoring the once-a-day rule. */
  repairNow(): void;
  /** Promises kept for a week, resolved as kept; Vinnie should say something. */
  collectKeptPromises(now?: Date): LedgerEntry[];
  setHeat(heat: Heat): void;
  setLimit(limitMinor: number): void;
  setPrefill(q: QuickAdd | null): Promise<void>;
  /**
   * Playtests: replaces this month with example entries so the next small treat goes
   * over budget, and clears cooldowns and the honeymoon so the meltdown escalates.
   */
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

export const useGame = create<GameState>()((set, get) => {
  /** Updates Vinnie's state and saves it. */
  const setCharacter = (patch: Partial<CharacterState>) => {
    const character = { ...get().character, ...patch };
    set({ character });
    write((d) => saveCharacter(d, character));
  };

  const resolve = (events: LedgerEvent[], now: number) => {
    if (!events.length) return;
    const byId = new Map(events.map((e) => [e.id, e.resolved]));
    set((s) => ({
      ledger: s.ledger.map((l) =>
        byId.has(l.id) && l.resolved === null
          ? { ...l, resolved: byId.get(l.id)!, resolvedAt: now }
          : l,
      ),
    }));
    write((d) => resolveLedger(d, events, now));
  };

  /** Applies coin grants whose keys haven't been used. */
  const grant = (grants: CoinGrant[]) => {
    const used = new Set(get().coinTx.map((g) => g.key));
    const fresh = grants.filter((g) => !used.has(g.key));
    if (!fresh.length) return;
    set((s) => ({ coinTx: [...s.coinTx, ...fresh] }));
    const now = Date.now();
    write(async (d) => {
      for (const g of fresh) await grantCoins(d, g, now);
    });
  };

  /** Re-checks achievements, pays out new unlocks and queues their toasts. */
  const checkAchievements = (events: Partial<Record<AchievementEvent, number>> = {}) => {
    const { state, unlocked } = updateAchievements(
      get().achievements,
      { ...derivedProgress(get().entries), ...events },
      Date.now(),
    );
    set((s) => ({ achievements: state, toasts: [...s.toasts, ...unlocked] }));
    grant(unlocked.map((a) => ({ key: `ach:${a.id}`, delta: a.coins, reason: a.name })));
    write((d) => saveAchievements(d, state));
  };

  return {
    ready: false,
    entries: [],
    limitMinor: null,
    heat: 'classic',
    currency: 'USD',
    lastCategory: 'coffee',
    recentLineIds: [],
    installedAt: Date.now(),
    character: FRESH_CHARACTER(Date.now()),
    ledger: [],
    prefill: null,
    coinTx: [],
    achievements: {},
    inventory: [],
    toasts: [],

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
        const stored = await getCharacter(db, now.getTime());
        // Time away calms him down (or cheers him down) toward 50.
        const drift = driftMood(stored.mood, stored.moodAt, now.getTime());
        const character = { ...stored, mood: drift.mood, moodAt: drift.at };
        await saveCharacter(db, character);
        set({
          ready: true,
          entries: await listEntries(db),
          limitMinor: limit,
          heat: settings.heat,
          currency: settings.currency,
          lastCategory: settings.lastCategory,
          installedAt: settings.createdAt,
          character,
          ledger: await listLedger(db),
          coinTx: await listCoinTx(db),
          achievements: await listAchievements(db),
          inventory: await listInventory(db),
        });
        // A month that just closed within budget earns "Under Control".
        const prevMonth = toMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const goodMonth = lastMonthUnderControl(get().entries, await getLimit(db, prevMonth), now);
        checkAchievements(goodMonth ? { under_control: 1 } : {});
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
        ledger: s.ledger,
        character: {
          installedAt: s.installedAt,
          lastCrackAt: s.character.lastCrackAt,
          lastCallAt: s.character.lastCallAt,
        },
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
      setCharacter({ mood: clampMood(s.character.mood + reaction.moodDelta) });
      resolve(reaction.ledgerEvents, now.getTime());
      write(async (d) => {
        await insertEntry(d, entry);
        if (input.type !== 'saved') await updateSettings(d, { lastCategory: input.category });
        if (input.description) {
          await learnMerchant(d, input.description, input.category, entry.createdAt);
        }
      });
      grant(grantsForEntry(entry, s.entries, new Set(get().coinTx.map((g) => g.key))));
      checkAchievements();
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
      const entry = get().entries.find((e) => e.id === id);
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      write((d) => removeEntry(d, id, now));
      // Same-day deletes (and Undo) take back what that entry earned.
      const back = entry && reversalForDeletedEntry(entry, get().coinTx, toDateKey(new Date(now)));
      if (back) grant([back]);
    },

    removeExamples() {
      const now = Date.now();
      set((s) => ({ entries: s.entries.filter((e) => !e.isExample) }));
      write((d) => deleteExamples(d, now));
    },

    recordReply(tag, entry) {
      const l: LedgerEntry = {
        id: newId(),
        tag,
        category: entry.category,
        amountMinor: entry.amountMinor,
        entryId: entry.id,
        createdAt: Date.now(),
        resolved: null,
        resolvedAt: null,
      };
      set((s) => ({ ledger: [...s.ledger, l] }));
      write((d) => insertLedger(d, l));
      setCharacter({ mood: clampMood(get().character.mood + (REPLY_MOOD[tag] ?? 0)) });
      if (tag === 'admit') get().achievementEvent('apology');
    },

    declined() {
      setCharacter({ mood: clampMood(get().character.mood + DECLINE_MOOD) });
    },

    crackGlass(impact) {
      const c = get().character;
      const worse = crackWorse(
        { level: c.crackLevel, lastCrackAt: c.lastCrackAt, lastRepairDay: c.lastRepairDay },
        Date.now(),
      );
      setCharacter({
        crackLevel: worse.level,
        lastCrackAt: worse.lastCrackAt,
        // A fresh crack gets a new shape and lands where the fist did; a worse one grows
        // from the same spot.
        ...(c.crackLevel === 0 ? { crackSeed: Math.floor(Math.random() * 1e9), impact } : {}),
      });
      get().achievementEvent('glass');
    },

    callPlaced() {
      setCharacter({ lastCallAt: Date.now() });
    },

    repairIfDue(now = new Date()) {
      const c = get().character;
      const crack = {
        level: c.crackLevel,
        lastCrackAt: c.lastCrackAt,
        lastRepairDay: c.lastRepairDay,
      };
      if (!repairDue(crack, get().entries, now)) return false;
      const fixed = repairOnce(crack, now);
      setCharacter({ crackLevel: fixed.level, lastRepairDay: fixed.lastRepairDay });
      if (fixed.level === 0) get().achievementEvent('repaired');
      return true;
    },

    repairNow() {
      const level = Math.max(0, get().character.crackLevel - 1) as CharacterState['crackLevel'];
      setCharacter({ crackLevel: level });
      if (level === 0) get().achievementEvent('repaired');
    },

    achievementEvent(ev) {
      const cur = get().achievements[ev]?.progress ?? 0;
      checkAchievements({ [ev]: cur + 1 });
    },

    dismissToast() {
      set((s) => ({ toasts: s.toasts.slice(1) }));
    },

    buy(id) {
      const s = get();
      const coins = balance(s.coinTx);
      const check = canBuy(id, coins, s.inventory);
      if (!check.ok) return null;
      const now = Date.now();
      const spend: CoinGrant = { key: `buy:${id}:${now}`, delta: -check.cost, reason: id };
      set({ coinTx: [...s.coinTx, spend] });
      // The database refuses the spend if the balance changed underneath; it's atomic.
      write((d) => spendCoins(d, spend, now));
      const gift = GIFTS.find((g) => g.id === id);
      if (gift) {
        // Gifts lift his mood. They never repair the glass.
        setCharacter({ mood: clampMood(s.character.mood + gift.mood) });
        get().achievementEvent('first_gift');
        return gift.line;
      }
      const inventory = equip([...s.inventory, { itemId: id, equipped: false }], id, true);
      set({ inventory });
      write((d) => saveInventory(d, inventory, now));
      return itemById(id)?.line ?? null;
    },

    toggleEquip(id) {
      const owned = get().inventory.find((o) => o.itemId === id);
      if (!owned) return;
      const inventory = equip(get().inventory, id, !owned.equipped);
      set({ inventory });
      write((d) => saveInventory(d, inventory, Date.now()));
    },

    grantDebugCoins(n) {
      grant([{ key: `debug:${Date.now()}`, delta: n, reason: 'Playtest' }]);
    },

    collectKeptPromises(now = new Date()) {
      const kept = keptPromises(get().ledger, get().entries, now.getTime());
      if (!kept.length) return [];
      resolve(
        kept.map((l) => ({ id: l.id, resolved: 'kept' as const })),
        now.getTime(),
      );
      setCharacter({ mood: clampMood(get().character.mood + KEPT_PROMISE_MOOD * kept.length) });
      return kept;
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
      const installedAt = Math.min(get().installedAt, now.getTime() - HONEYMOON_MS - 1);
      set({ entries: [...others, ...demo], limitMinor: DEFAULT_LIMIT, installedAt });
      setCharacter({ lastCrackAt: null, lastCallAt: null });
      const t = now.getTime();
      write(async (d) => {
        await d.transaction(async () => {
          for (const e of removed) await removeEntry(d, e.id, t);
          for (const e of demo) await insertEntry(d, e);
          await saveLimit(d, month, DEFAULT_LIMIT);
          await setInstalledAt(d, installedAt);
        });
      });
    },

    async reset() {
      const now = Date.now();
      const month = toMonthKey(new Date(now));
      set({
        entries: [],
        limitMinor: DEFAULT_LIMIT,
        recentLineIds: [],
        ledger: [],
        character: FRESH_CHARACTER(now),
        coinTx: [],
        achievements: {},
        inventory: [],
        toasts: [],
      });
      write(async (d) => {
        await clearEntries(d);
        await clearProgression(d);
        await clearBudgets(d);
        await clearLedger(d);
        await resetCharacter(d, now);
        await saveLimit(d, month, DEFAULT_LIMIT);
      });
      await queue;
    },
  };
});
