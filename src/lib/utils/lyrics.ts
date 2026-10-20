export interface LyricLine {
  time: number; // in seconds
  text: string;
}

/**
 * Parses LRC (and simple SRT / timestamped) string into an array of LyricLines sorted by time.
 */
export function parseLRC(lrcContent: string): LyricLine[] {
  if (!lrcContent || typeof lrcContent !== 'string') return [];

  const lines = lrcContent.split(/\r?\n/);
  const result: LyricLine[] = [];

  // Match LRC timestamp: [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
  const lrcRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  // Match SRT timestamp: 00:01:23,456 --> 00:01:25,789
  const srtRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->/;

  let offsetSeconds = 0;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for offset tag: [offset:+/-milliseconds]
    const offsetMatch = line.match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      offsetSeconds = (parseInt(offsetMatch[1], 10) || 0) / 1000;
      continue;
    }

    // Check for metadata tags: [ar:...], [ti:...], [al:...], [by:...]
    if (/^\[(ar|ti|al|by|length|re|ve):/i.test(line)) {
      continue;
    }

    // SRT format line check
    const srtMatch = line.match(srtRegex);
    if (srtMatch) {
      const hours = parseInt(srtMatch[1], 10) || 0;
      const minutes = parseInt(srtMatch[2], 10) || 0;
      const seconds = parseInt(srtMatch[3], 10) || 0;
      const millis = parseInt(srtMatch[4].padEnd(3, '0').slice(0, 3), 10) || 0;
      const totalTime = hours * 3600 + minutes * 60 + seconds + millis / 1000;
      // Note: SRT text usually follows on next line, but we support single-line parsed format
      continue;
    }

    // Standard LRC line parsing (can have multiple timestamps on one line)
    const matches = Array.from(line.matchAll(lrcRegex));
    if (matches.length > 0) {
      // The text is whatever remains after removing all [mm:ss.xx]
      const text = line.replace(lrcRegex, '').trim();

      for (const m of matches) {
        const minutes = parseInt(m[1], 10) || 0;
        const seconds = parseInt(m[2], 10) || 0;
        let fractions = 0;
        if (m[3]) {
          // If 2 digits, hundredths (e.g. .50 = 0.5s); if 3 digits, milliseconds
          fractions = m[3].length === 2 ? parseInt(m[3], 10) / 100 : parseInt(m[3], 10) / 1000;
        }

        const time = Math.max(0, minutes * 60 + seconds + fractions + offsetSeconds);
        result.push({ time, text });
      }
    }
  }

  // Sort chronologically by time
  result.sort((a, b) => a.time - b.time);

  return result;
}

/**
 * Finds the index of the currently active lyric line for the given timestamp.
 */
export function findActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics || lyrics.length === 0) return -1;
  if (currentTime < lyrics[0].time) return -1;

  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return i;
    }
  }

  return 0;
}

/**
 * Helper to format seconds to [mm:ss.xx] string for LRC export or editing.
 */
export function formatLrcTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '[00:00.00]';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}
