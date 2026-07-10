/**
 * Built-in scripted scenarios (ADR-001), assembled from real rows of
 * `Music Database.csv` at load time — no invented metadata. Rows are picked
 * per clip type so a "full spell" covers all four categories, one per pillar.
 */
import { MusicDatabase } from './music-database';
import { Scenario } from './scenario';
import { ClipTypes } from './types';

type ScenarioIngredient = { rfid: string; pillar: number };

/**
 * Picks one working CSV row per clip type (Drums, Melody, Bass, Vox), each
 * assigned to its own pillar. Throws if the database lacks a type entirely.
 */
export function pickScenarioIngredients(
  database: MusicDatabase,
): Record<ClipTypes, ScenarioIngredient> {
  const wanted = [ClipTypes.Drums, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Vox];
  const picks = {} as Record<ClipTypes, ScenarioIngredient>;
  wanted.forEach((type, pillar) => {
    const entry = Object.entries(database.rfidToClipMap).find(
      ([rfid, metadata]) => metadata.type === type && database.bpmByRfid[rfid] !== undefined,
    );
    if (!entry) {
      throw new Error(`Music Database.csv has no usable ${type} row for scenarios`);
    }
    picks[type] = { rfid: entry[0], pillar };
  });
  return picks;
}

export function buildScenarios(database: MusicDatabase): Record<string, Scenario> {
  const picks = pickScenarioIngredients(database);
  const drums = picks[ClipTypes.Drums];
  const melody = picks[ClipTypes.Melody];
  const bass = picks[ClipTypes.Bass];
  const vox = picks[ClipTypes.Vox];

  const fullSpell: Scenario = {
    name: 'full-spell',
    description:
      'Visitors build up a four-ingredient spell (drums → melody → bass → vox), hold it, then take it apart. Loops.',
    loopAfterMs: 15000,
    steps: [
      { at: 2000, action: { kind: 'new-tag', ...drums } },
      { at: 8000, action: { kind: 'new-tag', ...melody } },
      { at: 14000, action: { kind: 'new-tag', ...bass } },
      { at: 20000, action: { kind: 'new-tag', ...vox } },
      { at: 40000, action: { kind: 'departed-tag', ...vox } },
      { at: 44000, action: { kind: 'departed-tag', ...bass } },
      { at: 48000, action: { kind: 'departed-tag', ...melody } },
      { at: 52000, action: { kind: 'departed-tag', ...drums } },
    ],
  };

  // Second ingredient of the same type, to demonstrate one-object-per-pillar
  // replacement on the drums pillar.
  const secondDrumsEntry = Object.entries(database.rfidToClipMap).find(
    ([rfid, metadata]) =>
      metadata.type === ClipTypes.Drums &&
      rfid !== drums.rfid &&
      database.bpmByRfid[rfid] !== undefined,
  );

  const replaceIngredient: Scenario = {
    name: 'replace-ingredient',
    description:
      'One pillar plays drums while melody joins; the drums object is then swapped for a different drums object (one object per pillar). Loops.',
    loopAfterMs: 15000,
    steps: [
      { at: 2000, action: { kind: 'new-tag', ...drums } },
      { at: 6000, action: { kind: 'new-tag', ...melody } },
      ...(secondDrumsEntry
        ? [
            {
              at: 16000,
              action: { kind: 'departed-tag', ...drums } as const,
              description: 'swap: old drums object lifted',
            },
            {
              at: 17000,
              action: {
                kind: 'new-tag',
                rfid: secondDrumsEntry[0],
                pillar: drums.pillar,
              } as const,
              description: 'swap: new drums object placed',
            },
          ]
        : []),
      { at: 30000, action: { kind: 'departed-tag', ...melody } },
      {
        at: 31000,
        action: {
          kind: 'departed-tag',
          rfid: secondDrumsEntry ? secondDrumsEntry[0] : drums.rfid,
          pillar: drums.pillar,
        },
      },
    ],
  };

  const timeout: Scenario = {
    name: 'timeout',
    description:
      'One ingredient plays and is then left alone, so the idle timeout fires: timeout_warning at 2m30s after the last event, clips stopped at 3m (shorten via SIM_TIMEOUT_MS / SIM_TIMEOUT_WARNING_MS).',
    steps: [{ at: 2000, action: { kind: 'new-tag', ...drums } }],
  };

  const idle: Scenario = {
    name: 'idle',
    description:
      'No scripted activity — drive the simulator manually (e.g. from the UI debug panel or a socket client).',
    steps: [],
  };

  return {
    [fullSpell.name]: fullSpell,
    [replaceIngredient.name]: replaceIngredient,
    [timeout.name]: timeout,
    [idle.name]: idle,
  };
}
