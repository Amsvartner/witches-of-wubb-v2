import { KeyTranspositionService } from '../KeyTranspositionService';

const { TRANSPOSITIONS } = KeyTranspositionService;
const ALL_KEYS = Object.keys(TRANSPOSITIONS);

describe('KeyTranspositionService.TRANSPOSITIONS', () => {
  it('has exactly 24 Camelot keys: 12 major (B) + 12 minor (A)', () => {
    expect(ALL_KEYS).toHaveLength(24);
    expect(ALL_KEYS.filter((key) => key.endsWith('B'))).toHaveLength(12);
    expect(ALL_KEYS.filter((key) => key.endsWith('A'))).toHaveLength(12);
  });

  it.each(ALL_KEYS)('%s maps every other same-letter key exactly once, and never itself', (key) => {
    const letter = key.slice(-1);
    const expectedTargets = ALL_KEYS.filter((other) => other.endsWith(letter) && other !== key);
    const actualTargets = Object.keys(TRANSPOSITIONS[key]);
    expect(actualTargets.slice().sort()).toEqual(expectedTargets.slice().sort());
    expect(TRANSPOSITIONS[key][key]).toBeUndefined();
  });

  it('is symmetric for every pair: X→Y and Y→X sum to 0, except at the tritone (6 semitones), where both directions agree in sign and sum to ±12', () => {
    const checked = new Set<string>();
    for (const keyA of ALL_KEYS) {
      for (const keyB of Object.keys(TRANSPOSITIONS[keyA])) {
        const pairId = [keyA, keyB].sort().join('|');
        if (checked.has(pairId)) continue;
        checked.add(pairId);

        const forward = TRANSPOSITIONS[keyA][keyB];
        const backward = TRANSPOSITIONS[keyB]?.[keyA];
        if (backward === undefined) {
          throw new Error(`${keyB}→${keyA} should exist since ${keyA}→${keyB} does`);
        }
        expect([0, 12, -12]).toContain(forward + backward);
      }
    }
  });

  // The source flags these two entries with a `(verify pattern)` comment
  // (KeyTranspositionService.ts:116 for 9B, :285 for 6A) - explicitly confirming
  // them here per the ticket, even though the two tests above already cover every
  // key including these. If either fails, per the ticket's stop condition this is
  // a musical/artist decision - do not "fix" the table, document and stop instead.
  it.each(['9B', '6A'])(
    'confirms the (verify pattern)-flagged entry %s is complete and symmetric',
    (flaggedKey) => {
      const letter = flaggedKey.slice(-1);
      const expectedTargets = ALL_KEYS.filter(
        (other) => other.endsWith(letter) && other !== flaggedKey,
      );
      expect(Object.keys(TRANSPOSITIONS[flaggedKey]).slice().sort()).toEqual(
        expectedTargets.slice().sort(),
      );

      for (const [otherKey, forward] of Object.entries(TRANSPOSITIONS[flaggedKey])) {
        const backward = TRANSPOSITIONS[otherKey]?.[flaggedKey];
        expect(backward).toBeDefined();
        expect([0, 12, -12]).toContain(forward + backward);
      }
    },
  );
});
