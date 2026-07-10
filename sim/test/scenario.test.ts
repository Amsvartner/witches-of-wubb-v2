import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClipTypes,
  MusicDatabase,
  Scenario,
  SimEmittedEvent,
  Simulator,
  buildMusicDatabase,
  buildScenarios,
  pickScenarioIngredients,
  runScenario,
} from '../core';

const csvText = fs.readFileSync(
  path.join(process.cwd(), 'src', 'assets', 'Music Database.csv'),
  'utf-8',
);
const database: MusicDatabase = buildMusicDatabase(csvText);
const picks = pickScenarioIngredients(database);

const silentLogger = { info: () => undefined, warn: () => undefined };

describe('scenario engine', () => {
  let simulator: Simulator;
  let events: SimEmittedEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    simulator = new Simulator({ database, logger: silentLogger });
    events = [];
    simulator.onEvent((event) => events.push(event));
  });

  afterEach(() => {
    simulator.dispose();
    vi.useRealTimers();
  });

  it('replays steps deterministically at their scheduled times', () => {
    const drums = picks[ClipTypes.Drums];
    const scenario: Scenario = {
      name: 'test',
      description: 'place and remove one ingredient',
      steps: [
        { at: 1000, action: { kind: 'new-tag', ...drums } },
        { at: 5000, action: { kind: 'departed-tag', ...drums } },
      ],
    };
    const run = runScenario(simulator, scenario);

    vi.advanceTimersByTime(999);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events.map((e) => e.eventName)).toContain('ingredient_detected');

    vi.advanceTimersByTime(4000);
    expect(events.map((e) => e.eventName)).toContain('ingredient_removed');
    run.stop();
  });

  it('stops cleanly: no steps fire after stop()', () => {
    const drums = picks[ClipTypes.Drums];
    const scenario: Scenario = {
      name: 'test',
      description: 'never reached',
      steps: [{ at: 1000, action: { kind: 'new-tag', ...drums } }],
    };
    const run = runScenario(simulator, scenario);
    run.stop();
    vi.advanceTimersByTime(10000);
    expect(events).toEqual([]);
  });

  it('loops when loopAfterMs is set', () => {
    const drums = picks[ClipTypes.Drums];
    const scenario: Scenario = {
      name: 'test-loop',
      description: 'loops',
      loopAfterMs: 1000,
      steps: [
        { at: 100, action: { kind: 'new-tag', ...drums } },
        { at: 200, action: { kind: 'departed-tag', ...drums } },
      ],
    };
    const run = runScenario(simulator, scenario);
    vi.advanceTimersByTime(200);
    const firstRoundDetections = events.filter((e) => e.eventName === 'ingredient_detected');
    expect(firstRoundDetections).toHaveLength(1);

    // Loop restarts loopAfterMs after the last step
    vi.advanceTimersByTime(1000 + 100);
    const detections = events.filter((e) => e.eventName === 'ingredient_detected');
    expect(detections).toHaveLength(2);
    run.stop();
  });
});

describe('built-in scenarios', () => {
  it('builds all scenarios from real CSV rows', () => {
    const scenarios = buildScenarios(database);
    expect(Object.keys(scenarios).sort()).toEqual([
      'full-spell',
      'idle',
      'replace-ingredient',
      'timeout',
    ]);
    Object.values(scenarios).forEach((scenario) => {
      scenario.steps.forEach((step) => {
        if (step.action.kind === 'new-tag' || step.action.kind === 'departed-tag') {
          expect(
            database.rfidToClipMap[step.action.rfid],
            `${scenario.name} uses unknown rfid ${step.action.rfid}`,
          ).toBeTruthy();
        }
      });
    });
  });

  it('full-spell covers all four clip types on four distinct pillars', () => {
    const scenarios = buildScenarios(database);
    const placements = scenarios['full-spell'].steps.filter(
      (step) => step.action.kind === 'new-tag',
    );
    const types = placements.map(
      (step) =>
        database.rfidToClipMap[(step.action as { kind: 'new-tag'; rfid: string }).rfid].type,
    );
    expect(types.sort()).toEqual([...Object.values(ClipTypes)].sort());
    const pillars = placements.map(
      (step) => (step.action as { kind: 'new-tag'; pillar: number }).pillar,
    );
    expect(new Set(pillars).size).toBe(4);
  });
});
