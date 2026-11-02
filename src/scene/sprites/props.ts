// Placeholder prop sprites. Each is a palette-row grid like Vinnie; states are
// separate sprites so the scene can swap them.

import { PlantState } from '@/domain/roomState';

import { blit, createBuffer, hex, PixelBuffer, spriteFromRows } from '../pixels';

const POT = {
  O: hex('#8a4a28'),
  o: hex('#b5653a'),
  m: hex('#4a3020'),
};

const POT_ROWS = [
  '..OOOOOO..',
  '..ommmmo..',
  '..oooooO..',
  '...oooO...',
  '...oooO...',
  '....OO....',
];

const PLANT_TOPS: Record<PlantState, string[]> = {
  healthy: [
    '...lg.....',
    '..lgg..g..',
    '.lggg.lgg.',
    '.gGgglggG.',
    'lgGgggggGg',
    '.ggGgGgGg.',
    '..gGgggG..',
    '...gGgG...',
    '....gG....',
    '....G.....',
  ],
  droopy: [
    '..........',
    '..........',
    '....aa....',
    '..aaAaa...',
    '.aAaaaAa..',
    'aA.aAaa.Aa',
    'a..aAAa..a',
    '...aAaA...',
    '....aA....',
    '....A.....',
  ],
  wilted: [
    '..........',
    '..........',
    '..........',
    '....tt....',
    '...tTtt...',
    '..tT.Ttt..',
    '.tT..T.tT.',
    't...TT..t.',
    't...T....t',
    '....T.....',
  ],
  dead: [
    '..........',
    '..........',
    '..........',
    '..........',
    '.....x....',
    '..x..x.x..',
    '...x.xx...',
    '....xx....',
    '....x.....',
    '....x.....',
  ],
};

const PLANT_PALETTE = {
  ...POT,
  G: hex('#3f7d3a'),
  g: hex('#5fae4f'),
  l: hex('#8fd16a'),
  a: hex('#9db84a'),
  A: hex('#6f8a35'),
  t: hex('#b39a4a'),
  T: hex('#7d6a2e'),
  x: hex('#6b4a2e'),
};

export function buildPlant(state: PlantState): PixelBuffer {
  return spriteFromRows([...PLANT_TOPS[state], ...POT_ROWS], PLANT_PALETTE);
}

// --- Wastebasket and the receipt pile -------------------------------------------

const BIN = spriteFromRows(
  ['KKKKKKK', '.nnnnn.', '.nKnKn.', '.nnnnn.', '.nKnKn.', '.nnnnn.', '..nnn..'],
  { K: hex('#4a4a4a'), n: hex('#7a7a7a') },
);
const BALL = spriteFromRows(['.q.', 'qQq', '.Q.'], { q: hex('#fffdf6'), Q: hex('#d9d4c7') });

export const PILE_W = 24;
export const PILE_H = 14;
/** Bin's top-left inside the pile sprite. */
const BIN_AT = { x: 16, y: 7 };
/** Where each crumpled receipt lands, in order: on top of the bin, then the floor. */
const BALL_SPOTS = [
  [16, 5],
  [19, 5],
  [17, 3],
  [20, 2],
  [12, 11],
  [9, 11],
  [6, 11],
  [10, 9],
  [13, 9],
  [7, 9],
  [3, 11],
  [11, 7],
  [8, 7],
  [5, 9],
] as const;

export function buildReceiptPile(count: number): PixelBuffer {
  const buf = createBuffer(PILE_W, PILE_H);
  blit(buf, BIN, BIN_AT.x, BIN_AT.y);
  // Floor balls go behind the bin's front edge only if they overlap; draw bin-top ones last.
  const spots = BALL_SPOTS.slice(0, Math.min(count, BALL_SPOTS.length));
  for (const [x, y] of spots.slice(4)) blit(buf, BALL, x, y);
  for (const [x, y] of spots.slice(0, 4)) blit(buf, BALL, x, y);
  return buf;
}

// --- Deductible the cat ----------------------------------------------------------

const CAT_PALETTE = {
  c: hex('#d98a3a'),
  C: hex('#a8622a'),
  w: hex('#f5e9d6'),
  e: hex('#2b2b2b'),
  n: hex('#e08a8a'),
};

export const CAT_SLEEPING = [
  spriteFromRows(['.c.c.....', '.ccccccc.', 'cceccCccc', 'ccccCcCcc', '.CCCCCCCc'], CAT_PALETTE),
  spriteFromRows(['.c.c.....', '.ccccccc.', 'cceccCccc', 'ccccCcCcc', '.CCCCCCC.'], CAT_PALETTE),
];

export const CAT_SITTING = [
  spriteFromRows(
    [
      'c...c..',
      'ccccc..',
      'cecec..',
      'ccncc..',
      '.ccc...',
      'cCcCc..',
      'cwcwc.c',
      'cwwwc.c',
      'cCcCcc.',
    ],
    CAT_PALETTE,
  ),
  spriteFromRows(
    [
      'c...c..',
      'ccccc..',
      'cecec..',
      'ccncc..',
      '.ccc..c',
      'cCcCc.c',
      'cwcwc.c',
      'cwwwcc.',
      'cCcCc..',
    ],
    CAT_PALETTE,
  ),
];

// --- Desk and cabinet top items ---------------------------------------------------

export const PHONE = spriteFromRows(['.KKKKK.', 'KKKKKKK', '.KqKqK.', '.KKKKK.', 'KKKKKKK'], {
  K: hex('#1f1f1f'),
  q: hex('#e8e8e8'),
});

export const LAMP = spriteFromRows(
  ['.LLL.', 'LlllL', '..Y..', '..Y..', '..Y..', '..Y..', '.YYY.', 'YYYYY'],
  { L: hex('#2f7a4a'), l: hex('#4fae6a'), Y: hex('#c9a227') },
);

export const ESPRESSO = spriteFromRows(
  [
    'DDDDDDDD',
    'DMMMMMMD',
    'DMrMMMMD',
    'DMMMMMMD',
    'DDDkkDDD',
    '...kk...',
    '........',
    '..qqqq..',
    'DDDDDDDD',
  ],
  {
    D: hex('#7a7a7a'),
    M: hex('#b8b8b8'),
    r: hex('#d64541'),
    k: hex('#1f1f1f'),
    q: hex('#fffdf6'),
  },
);

const STEAM = { v: hex('#ffffff', 170) };
export const STEAM_FRAMES = [
  ['..v..', '.v...', '.v...', '..v..', '...v.', '..v..'],
  ['.v...', '..v..', '...v.', '...v.', '..v..', '.v...'],
  ['...v.', '..v..', '.v...', '.v...', '..v..', '..v..'],
].map((rows) => spriteFromRows(rows, STEAM));
