/**
 * Offline simulator server (ADR-001, WOW-003): thin socket.io wrapper binding
 * `sim/core` to port 3335, matching the real backend's transport
 * (backend/index.ts) so the frontend needs no config change.
 *
 * Run with `yarn sim [scenario]` (see README). This process must stay
 * incapable of reaching Ableton or hardware: its only imports are node
 * built-ins, socket.io (listening on localhost only), and sim/core.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import {
  Simulator,
  TagDetectionData,
  SetTrackVolumeInputType,
  buildMusicDatabase,
  buildScenarios,
  runScenario,
} from './core';

const WS_PORT = 3335; // fixed by ADR-001; matches VITE_WS_SERVER_PORT in .env

const log = (message: string) => {
  console.log(`[sim ${new Date().toISOString()}] ${message}`);
};

const csvPath = path.join(process.cwd(), 'src', 'assets', 'Music Database.csv');
const database = buildMusicDatabase(fs.readFileSync(csvPath, 'utf-8'));
log(`Loaded ${Object.keys(database.rfidToClipMap).length} clips from Music Database.csv`);

const scenarios = buildScenarios(database);
const scenarioName = process.argv[2] ?? 'idle';
const scenario = scenarios[scenarioName];
if (!scenario) {
  console.error(
    `Unknown scenario "${scenarioName}". Available: ${Object.keys(scenarios).join(', ')}`,
  );
  process.exit(1);
}

// Demo aid: the real 3m/30s idle timeout (backend/ableton-api.ts:19-20) can
// be shortened to see timeout_warning quickly. Invalid values are ignored
// with a warning so a typo can't produce 0ms/NaN timers.
function envMs(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.warn(`[sim] Ignoring ${name}="${raw}" — must be a positive number of milliseconds`);
    return undefined;
  }
  return value;
}

const simulator = new Simulator({
  database,
  timeoutMs: envMs('SIM_TIMEOUT_MS'),
  timeoutWarningMs: envMs('SIM_TIMEOUT_WARNING_MS'),
  logger: {
    info: (message) => log(message),
    warn: (message) => log(`WARN ${message}`),
  },
});

// Localhost-only bind: the simulator is a local dev tool and must not be
// reachable from the installation network. The real backend binds wider
// (backend/index.ts:15) — intentional sim-only restriction.
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: { origin: true },
});
httpServer.listen(WS_PORT, '127.0.0.1');

simulator.onEvent(({ eventName, data }) => {
  io.emit(eventName, data);
});

io.on('connection', (socket) => {
  log(`Web client connected (${socket.id})`);
  socket.on('disconnect', () => log(`Web client disconnected (${socket.id})`));

  const logReceived = (eventName: string, payload?: unknown) => {
    log(`recv ${eventName} ${payload !== undefined ? JSON.stringify(payload) : ''}`);
  };

  // Tag events — websocket variants of /new/tag and /departed/tag
  // (backend/events/incoming-events.ts:42-65)
  socket.on('/new/tag', (data: TagDetectionData) => {
    logReceived('/new/tag', data);
    simulator.handleNewTag(data);
  });
  socket.on('/departed/tag', (data: TagDetectionData) => {
    logReceived('/departed/tag', data);
    simulator.handleDepartedTag(data);
  });

  // Ack-style requests (backend/events/incoming-events.ts:110-176)
  socket.on('get_playing_clips', (_, callback) => {
    logReceived('get_playing_clips');
    callback(simulator.getPlayingClips());
  });
  socket.on('get_queued_clips', (_, callback) => {
    logReceived('get_queued_clips');
    callback(simulator.getQueuedClips());
  });
  socket.on('get_tempo', (_, callback) => {
    logReceived('get_tempo');
    callback(simulator.getTempo());
  });
  socket.on('set_tempo', (tempo: number, callback) => {
    logReceived('set_tempo', tempo);
    callback(simulator.setTempo(tempo));
  });
  socket.on('get_track_volumes', (_, callback) => {
    logReceived('get_track_volumes');
    callback(simulator.getTrackVolumes());
  });
  socket.on('get_keylock_state', (_, callback) => {
    logReceived('get_keylock_state');
    callback(simulator.getKeyLockState());
  });
  socket.on('set_keylock_state', (state: boolean, callback) => {
    logReceived('set_keylock_state', state);
    callback(simulator.setKeyLockState(state));
  });
  socket.on('get_master-key', (_, callback) => {
    logReceived('get_master-key');
    callback(simulator.getMasterKey());
  });

  // Fire-and-forget requests — the real backend registers no ack callback
  // (backend/events/incoming-events.ts:164,177)
  socket.on('set_track_volume', (data: SetTrackVolumeInputType) => {
    logReceived('set_track_volume', data);
    simulator.setTrackVolume(data);
  });
  socket.on('set_master-key', (newKey: string) => {
    logReceived('set_master-key', newKey);
    simulator.setMasterKey(newKey);
  });
});

log(`Simulator listening on localhost:${WS_PORT}`);
log(`Scenario: ${scenario.name} — ${scenario.description}`);
runScenario(simulator, scenario, log);
