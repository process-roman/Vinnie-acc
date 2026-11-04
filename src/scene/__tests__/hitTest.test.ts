import { describe, expect, it } from '@jest/globals';

import { characterAt, TAP_SLOP } from '../hitTest';

describe('characterAt', () => {
  const boxes = [
    { id: 'vinnie', x: 100, y: 100, w: 28, h: 44 },
    { id: 'cat', x: 160, y: 130, w: 16, h: 20 },
  ];

  it('finds what is right under the finger', () => {
    expect(characterAt(110, 120, boxes)).toBe('vinnie');
    expect(characterAt(165, 140, boxes)).toBe('cat');
    expect(characterAt(50, 50, boxes)).toBeNull();
  });

  it('forgives a near miss, but not a wide one', () => {
    expect(characterAt(155, 125, boxes)).toBeNull();
    expect(characterAt(155, 125, boxes, TAP_SLOP)).toBe('cat');
    expect(characterAt(50, 50, boxes, TAP_SLOP)).toBeNull();
  });

  it('picks the closer one when both are in reach', () => {
    const close = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 14, y: 0, w: 10, h: 10 },
    ];
    expect(characterAt(11, 5, close, TAP_SLOP)).toBe('a');
    expect(characterAt(13, 5, close, TAP_SLOP)).toBe('b');
  });
});
