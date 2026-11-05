// Web database: sql.js loaded from public/ (copied there by postinstall), saved to
// localStorage after each change. Good enough for development and demos.

import type { InitSqlJsStatic } from 'sql.js';

import { basePath, isDemo } from '@/services/demo';

import { Db } from './db';
import { migrate } from './migrations';
import { wrapSqlJs } from './sqljsDb';

const STORAGE_KEY = 'vinnie.db';
const SAVE_DELAY_MS = 300;

/** Set on window by public/sql-wasm-browser.js. */
const sqlJsGlobal = () => (globalThis as { initSqlJs?: InitSqlJsStatic }).initSqlJs;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function readSaved(): Uint8Array | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? fromBase64(saved) : undefined;
  } catch {
    return undefined;
  }
}

export async function openDb(): Promise<Db> {
  if (!sqlJsGlobal()) await loadScript(`${basePath}/sql-wasm-browser.js`);
  const SQL = await sqlJsGlobal()!({ locateFile: (f) => `${basePath}/${f}` });
  // The demo starts fresh for everyone and keeps nothing.
  const sql = new SQL.Database(isDemo ? undefined : readSaved());

  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (isDemo) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, toBase64(sql.export()));
      } catch {
        // Storage full or blocked: keep working in memory.
      }
    }, SAVE_DELAY_MS);
  };

  const db = wrapSqlJs(sql, save);
  await migrate(db);
  return db;
}
