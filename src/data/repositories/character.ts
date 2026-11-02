// Vinnie's own state: mood, the crack in the glass, escalation cooldowns.
// Kept apart from financial data (blueprint B4).

import type { CrackLevel } from '@/domain/repair';

import { Db } from '../db';

export type CharacterState = {
  mood: number;
  /** When mood drift was last applied. */
  moodAt: number;
  crackLevel: CrackLevel;
  crackSeed: number;
  /** Where the fist landed, as a fraction of the window (survives rotation and devices). */
  impact: { x: number; y: number } | null;
  lastCrackAt: number | null;
  lastCallAt: number | null;
  lastRepairDay: string | null;
};

type Row = {
  mood: number;
  mood_at: number;
  crack_level: number;
  crack_seed: number;
  impact_x: number | null;
  impact_y: number | null;
  last_crack_at: number | null;
  last_call_at: number | null;
  last_repair_day: string | null;
};

/** Reads the state, creating it on first launch. */
export async function getCharacter(db: Db, now: number): Promise<CharacterState> {
  await db.run('INSERT OR IGNORE INTO character_state (id, mood_at) VALUES (1, ?)', [now]);
  const r = (await db.get<Row>('SELECT * FROM character_state WHERE id = 1'))!;
  return {
    mood: r.mood,
    moodAt: r.mood_at,
    crackLevel: r.crack_level as CrackLevel,
    crackSeed: r.crack_seed,
    impact: r.impact_x === null || r.impact_y === null ? null : { x: r.impact_x, y: r.impact_y },
    lastCrackAt: r.last_crack_at,
    lastCallAt: r.last_call_at,
    lastRepairDay: r.last_repair_day,
  };
}

export async function saveCharacter(db: Db, c: CharacterState): Promise<void> {
  await db.run(
    `UPDATE character_state SET mood = ?, mood_at = ?, crack_level = ?, crack_seed = ?,
       impact_x = ?, impact_y = ?, last_crack_at = ?, last_call_at = ?, last_repair_day = ?
     WHERE id = 1`,
    [
      c.mood,
      c.moodAt,
      c.crackLevel,
      c.crackSeed,
      c.impact?.x ?? null,
      c.impact?.y ?? null,
      c.lastCrackAt,
      c.lastCallAt,
      c.lastRepairDay,
    ],
  );
}

export async function resetCharacter(db: Db, now: number): Promise<void> {
  await db.run('DELETE FROM character_state');
  await getCharacter(db, now);
}
