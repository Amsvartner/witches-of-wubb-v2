import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../../sim/core';

describe('parseCsvText', () => {
  it('parses simple rows into header-keyed objects', () => {
    const rows = parseCsvText('a,b,c\n1,2,3\n4,5,6\n');
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('handles quoted fields containing commas (as in the instrument column)', () => {
    const rows = parseCsvText('name,instrument\nPond Scum,"Piano, Vox, Strings"\n');
    expect(rows).toEqual([{ name: 'Pond Scum', instrument: 'Piano, Vox, Strings' }]);
  });

  it('handles escaped double quotes (as in clip names like ""Doink U"" Vox 122)', () => {
    const rows = parseCsvText('clip\n"""Doink U"" Vox 122"\n');
    expect(rows).toEqual([{ clip: '"Doink U" Vox 122' }]);
  });

  it('handles CRLF line endings and missing trailing newline', () => {
    const rows = parseCsvText('a,b\r\n1,2\r\n3,4');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('fills missing trailing cells with empty strings', () => {
    const rows = parseCsvText('a,b,c\n1\n');
    expect(rows).toEqual([{ a: '1', b: '', c: '' }]);
  });
});
