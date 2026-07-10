/**
 * Scripted-scenario engine (ADR-001): replays a timed sequence of pillar/tag
 * actions against a Simulator, standing in for visitors placing and removing
 * objects. Time-driven via setTimeout so vitest can fast-forward with fake
 * timers.
 */
import { Simulator } from './simulator';

export type ScenarioStep = {
  /** Milliseconds from scenario start. */
  at: number;
  action:
    | { kind: 'new-tag'; rfid: string; pillar: number }
    | { kind: 'departed-tag'; rfid: string; pillar: number }
    | { kind: 'set-tempo'; tempo: number };
  description?: string;
};

export type Scenario = {
  name: string;
  description: string;
  /** Restart the script from the top this long after the last step (ms). */
  loopAfterMs?: number;
  steps: ScenarioStep[];
};

export type ScenarioRunHandle = {
  stop: () => void;
};

function applyStep(simulator: Simulator, step: ScenarioStep) {
  const { action } = step;
  switch (action.kind) {
    case 'new-tag':
      simulator.handleNewTag({ rfid: action.rfid, pillar: action.pillar });
      break;
    case 'departed-tag':
      simulator.handleDepartedTag({ rfid: action.rfid, pillar: action.pillar });
      break;
    case 'set-tempo':
      simulator.setTempo(action.tempo);
      break;
  }
}

export function runScenario(
  simulator: Simulator,
  scenario: Scenario,
  log: (message: string) => void = () => undefined,
): ScenarioRunHandle {
  let timerIds: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;

  const scheduleRound = () => {
    timerIds = scenario.steps.map((step) =>
      setTimeout(() => {
        log(`scenario "${scenario.name}" step @${step.at}ms: ${describeStep(step)}`);
        applyStep(simulator, step);
      }, step.at),
    );
    if (scenario.loopAfterMs !== undefined) {
      const lastAt = Math.max(0, ...scenario.steps.map((step) => step.at));
      timerIds.push(
        setTimeout(() => {
          if (!stopped) {
            log(`scenario "${scenario.name}" looping`);
            scheduleRound();
          }
        }, lastAt + scenario.loopAfterMs),
      );
    }
  };

  log(`scenario "${scenario.name}" started: ${scenario.description}`);
  scheduleRound();

  return {
    stop: () => {
      stopped = true;
      timerIds.forEach((id) => clearTimeout(id));
      timerIds = [];
    },
  };
}

export function describeStep(step: ScenarioStep): string {
  if (step.description) return step.description;
  const { action } = step;
  switch (action.kind) {
    case 'new-tag':
      return `place ${action.rfid} on pillar ${action.pillar + 1}`;
    case 'departed-tag':
      return `remove ${action.rfid} from pillar ${action.pillar + 1}`;
    case 'set-tempo':
      return `set tempo to ${action.tempo}`;
  }
}
