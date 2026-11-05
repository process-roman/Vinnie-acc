// The game's sound effects (see scripts/generate-sounds.js). They follow the Sound switch,
// the media volume, and on iPhone the silent switch. A sound that fails to play never
// gets in the game's way.

import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import approve from '../../assets/sounds/approve.wav';
import click from '../../assets/sounds/click.wav';
import coin from '../../assets/sounds/coin.wav';
import crack from '../../assets/sounds/crack.wav';
import frown from '../../assets/sounds/frown.wav';
import hiss from '../../assets/sounds/hiss.wav';
import meow from '../../assets/sounds/meow.wav';
import punch from '../../assets/sounds/punch.wav';
import rain from '../../assets/sounds/rain.wav';
import ring from '../../assets/sounds/ring.wav';
import rustle from '../../assets/sounds/rustle.wav';
import scurry from '../../assets/sounds/scurry.wav';
import talk from '../../assets/sounds/talk.wav';
import tape from '../../assets/sounds/tape.wav';
import thud from '../../assets/sounds/thud.wav';
import yowl from '../../assets/sounds/yowl.wav';

const SOURCES = {
  approve,
  click,
  coin,
  crack,
  frown,
  hiss,
  meow,
  punch,
  rain,
  ring,
  rustle,
  scurry,
  talk,
  tape,
  thud,
  yowl,
};

export type SoundName = keyof typeof SOURCES;
export type LoopName = 'rain' | 'ring' | 'talk';

/** These play under everything else, so they sit lower. The rest is levelled in the files. */
const VOLUME: Partial<Record<SoundName, number>> = {
  rain: 0.3,
  talk: 0.45,
};

let enabled = true;
const players = new Map<SoundName, AudioPlayer>();
/** Loops that should be playing right now, whether or not sound is on. */
const activeLoops = new Set<LoopName>();

function player(name: SoundName): AudioPlayer {
  let p = players.get(name);
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    p.volume = VOLUME[name] ?? 1;
    players.set(name, p);
  }
  return p;
}

function attempt(what: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.warn(`[vinnie] sound failed: ${what}`, e);
  }
}

function resume(name: LoopName): void {
  attempt(name, () => {
    const p = player(name);
    p.loop = true;
    // Vinnie doesn't start every sentence with the same syllables.
    if (name === 'talk') p.seekTo(Math.random() * 3.5);
    p.play();
  });
}

function halt(name: LoopName): void {
  attempt(name, () => {
    const p = player(name);
    p.pause();
    if (name === 'ring') p.seekTo(0);
  });
}

/** Sets up audio and loads the sounds, so the first punch isn't late. */
export function prepareSounds(): void {
  attempt('setup', () => {
    // iPhone's silent switch means silent. Android is different: games follow the media
    // volume there, and this setting would mute everything whenever the ringer's on vibrate.
    setAudioModeAsync({
      playsInSilentMode: Platform.OS !== 'ios',
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }).catch((e) => console.warn('[vinnie] could not set audio mode', e));
    for (const name of Object.keys(SOURCES) as SoundName[]) player(name);
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && enabled) activeLoops.forEach(resume);
  });
}

/** The Sound switch in Settings. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  activeLoops.forEach(on ? resume : halt);
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  attempt(name, () => {
    const p = player(name);
    p.seekTo(0);
    p.play();
  });
}

/** Keeps a loop playing for as long as `active` is true. */
export function useLoopingSound(name: LoopName, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    activeLoops.add(name);
    if (enabled) resume(name);
    return () => {
      activeLoops.delete(name);
      halt(name);
    };
  }, [name, active]);
}
