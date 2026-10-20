import { describe, it, expect } from 'vitest';
import { parseLRC, findActiveLyricIndex, formatLrcTime } from '../lib/utils/lyrics';

describe('Synchronized Lyrics (LRC) Utility', () => {
  it('parses standard [mm:ss.xx] LRC format lines in chronological order', () => {
    const lrc = `
[00:04.50] Primera línea de prueba
[00:09.20] Segunda línea
[00:15.00] Coro principal
    `;
    const parsed = parseLRC(lrc);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].time).toBeCloseTo(4.5, 2);
    expect(parsed[0].text).toBe('Primera línea de prueba');
    expect(parsed[1].time).toBeCloseTo(9.2, 2);
    expect(parsed[1].text).toBe('Segunda línea');
    expect(parsed[2].time).toBeCloseTo(15.0, 2);
    expect(parsed[2].text).toBe('Coro principal');
  });

  it('handles multiple timestamps on the same line (repeated chorus)', () => {
    const lrc = `[00:10.00][01:20.00] Verso repetido`;
    const parsed = parseLRC(lrc);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].time).toBe(10);
    expect(parsed[0].text).toBe('Verso repetido');
    expect(parsed[1].time).toBe(80);
    expect(parsed[1].text).toBe('Verso repetido');
  });

  it('ignores metadata header tags like [ti:], [ar:], [al:]', () => {
    const lrc = `
[ti: Bohemian Rhapsody]
[ar: Queen]
[al: A Night at the Opera]
[00:01.00] Is this the real life?
[00:04.50] Is this just fantasy?
    `;
    const parsed = parseLRC(lrc);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe('Is this the real life?');
    expect(parsed[1].text).toBe('Is this just fantasy?');
  });

  it('applies [offset:+/-ms] tag to adjust all timestamps', () => {
    const lrc = `
[offset:500]
[00:02.00] Con offset positivo
    `;
    const parsed = parseLRC(lrc);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].time).toBeCloseTo(2.5, 2);
  });

  it('handles empty or invalid inputs gracefully without throwing', () => {
    expect(parseLRC('')).toEqual([]);
    expect(parseLRC(null as any)).toEqual([]);
    expect(parseLRC('Texto sin marcas de tiempo ni corchetes')).toEqual([]);
  });

  it('accurately finds active lyric index based on current playback time', () => {
    const lyrics = [
      { time: 5, text: 'Línea 1' },
      { time: 10, text: 'Línea 2' },
      { time: 15, text: 'Línea 3' },
      { time: 25, text: 'Línea 4' },
    ];

    expect(findActiveLyricIndex(lyrics, 0)).toBe(-1); // Before song lyrics start
    expect(findActiveLyricIndex(lyrics, 4.9)).toBe(-1);
    expect(findActiveLyricIndex(lyrics, 5.0)).toBe(0); // Right at Line 1
    expect(findActiveLyricIndex(lyrics, 7.5)).toBe(0); // Between Line 1 and 2
    expect(findActiveLyricIndex(lyrics, 10.0)).toBe(1); // Right at Line 2
    expect(findActiveLyricIndex(lyrics, 14.99)).toBe(1);
    expect(findActiveLyricIndex(lyrics, 15.0)).toBe(2); // Line 3
    expect(findActiveLyricIndex(lyrics, 30.0)).toBe(3); // Past last line, remains on last line
  });

  it('correctly formats seconds to [mm:ss.xx] timestamp string', () => {
    expect(formatLrcTime(0)).toBe('[00:00.00]');
    expect(formatLrcTime(65.5)).toBe('[01:05.50]');
    expect(formatLrcTime(125.25)).toBe('[02:05.25]');
  });
});
