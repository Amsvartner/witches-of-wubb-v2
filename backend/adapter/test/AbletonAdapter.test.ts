import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AbletonAdapter } from '../AbletonAdapter';

// This test imports AbletonAdapter (and transitively ableton-js) despite the
// no-ableton-js-in-tests convention elsewhere in backend/**/test/**: the function under
// test (WOW-032's parseRemoteScriptVersion) is required by its ticket to live inside
// AbletonAdapter.ts specifically. Safe to import: the `Ableton` constructor (ableton-js
// index.js) only sets instance fields and computes tmpdir-based file paths - it opens no
// socket and does no I/O until .start() is called, which this test never does.
describe('AbletonAdapter.parseRemoteScriptVersion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-032-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFixture(content: string): string {
    const filePath = path.join(tmpDir, 'version.py');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it("parses a double-quoted version string, matching midi-script/version.py's own format", () => {
    const filePath = writeFixture('version = "3.1.5"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.1.5');
  });

  it('parses single-quoted version strings', () => {
    const filePath = writeFixture("version = '3.7.0'\n");
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.7.0');
  });

  it('parses pre-release/build-suffixed versions (e.g. ableton-js historical "2.2.1-0")', () => {
    const filePath = writeFixture('version = "2.2.1-0"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('2.2.1-0');
  });

  it('tolerates extra whitespace around the equals sign', () => {
    const filePath = writeFixture('version   =   "1.2.3"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('1.2.3');
  });

  it('returns undefined for a missing file instead of throwing', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.py');
    expect(AbletonAdapter.parseRemoteScriptVersion(missingPath)).toBeUndefined();
  });

  it('returns undefined for a file with no version line', () => {
    const filePath = writeFixture('# just a comment\nprint("hello")\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBeUndefined();
  });

  it('returns undefined for an empty file', () => {
    const filePath = writeFixture('');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBeUndefined();
  });

  it('parses the real, currently-installed ableton-js midi-script version.py', () => {
    // Regression guard against the actual file this ticket depends on, not just
    // synthetic fixtures - catches an ableton-js upgrade changing the file's format.
    const packageJsonPath = require.resolve('ableton-js/package.json');
    const realPath = path.join(path.dirname(packageJsonPath), 'midi-script', 'version.py');
    expect(AbletonAdapter.parseRemoteScriptVersion(realPath)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
// WOW-020: a clip with degenerate warp markers must not push Infinity/NaN
// into setTempo - calculateBpmFromWarpMarkers returns undefined instead so
// callers can skip tempo adoption.
//
// The existing (unchanged) formula is `(endBT - startBT) / ((endST - startST) / 60)`
// - dividing the sample_time span by 60 only produces a sane BPM if that
// span is in seconds, not raw audio samples, despite the field's name.
// Verified against a known-good case before writing fixtures: 4 beats over
// 2 seconds is 120 BPM, and `(4 - 0) / ((2 - 0) / 60) === 120`.
describe('AbletonAdapter.calculateBpmFromWarpMarkers', () => {
  it('returns undefined for zero warp markers (would otherwise throw destructuring markers[0])', () => {
    expect(AbletonAdapter.calculateBpmFromWarpMarkers([])).toBeUndefined();
  });

  it('returns undefined for a single warp marker (fewer than 2 markers - the span is never even computed)', () => {
    const markers = [{ beat_time: 0, sample_time: 1 }];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for two markers at the same sample_time (division by zero)', () => {
    const markers = [
      { beat_time: 0, sample_time: 1 },
      { beat_time: 4, sample_time: 1 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for a negative sample-time span (out-of-order markers)', () => {
    const markers = [
      { beat_time: 0, sample_time: 2 },
      { beat_time: 4, sample_time: 1 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for a non-finite result that slips past the earlier guards (e.g. a NaN sample_time)', () => {
    // NaN <= 0 is false in JS, so the sampleTimeSpan guard alone would not
    // catch this - only the final Number.isFinite catch-all does. Regression
    // guard for that third guard specifically (test-engineer review, PR #25):
    // without it, this fixture would fall through to bpm = NaN instead of
    // undefined, and the call site's `bpm === undefined` check would then
    // fail to fire the clip-attributed warning too.
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 4, sample_time: NaN },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('calculates BPM for a healthy two-marker array, byte-for-byte the same arithmetic as before this ticket', () => {
    // 4 beats over 2 seconds = 120 BPM.
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 4, sample_time: 2 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeCloseTo(120);
  });

  it('uses only the first and last markers for a healthy array with more than two', () => {
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 1, sample_time: 0.3 }, // ignored - not first or last
      { beat_time: 4, sample_time: 2 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeCloseTo(120);
  });
});
