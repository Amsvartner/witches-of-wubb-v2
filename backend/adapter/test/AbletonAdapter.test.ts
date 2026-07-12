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

  it('parses a real ableton-js midi-script version.py (double-quoted)', () => {
    const filePath = writeFixture('version = "3.1.5"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.1.5');
  });

  it('parses single-quoted version strings', () => {
    const filePath = writeFixture("version = '3.7.0'\n");
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.7.0');
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
