import { create } from 'zustand';

import type { Entry } from '@/domain/entries';
import type { FilledCall } from '@/domain/reaction/react';

type CallState = {
  /** The call that is ringing or in progress, with the entry that caused it (none for a check-in). */
  current: { id: number; call: FilledCall; entry: Entry | null } | null;
  /** Starts ringing. Resolves when the call is over (answered or not). */
  ring(call: FilledCall, entry: Entry | null): Promise<void>;
  hangUp(): void;
};

let onHangUp: (() => void) | null = null;

export const useCall = create<CallState>()((set) => ({
  current: null,
  ring(call, entry) {
    onHangUp?.();
    set({ current: { id: Date.now(), call, entry } });
    return new Promise<void>((resolve) => {
      onHangUp = resolve;
    });
  },
  hangUp() {
    set({ current: null });
    const done = onHangUp;
    onHangUp = null;
    done?.();
  },
}));
