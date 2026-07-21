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
  SetCauldronVolumeInputType,
  SetDjModeInputType,
  IdleTimeoutConfigType,
  buildMusicDatabase,
  buildScenarios,
  runScenario,
} from './core';

// 3335 per ADR-001 (matches VITE_WS_SERVER_PORT in .env). SIM_PORT overrides
// it for side-by-side verification when 3335 is held by a live backend —
// previously this required hand-patching the constant, and reverting that
// patch destroyed unrelated uncommitted work in this file once (WOW-007C).
const WS_PORT = Number(process.env.SIM_PORT) || 3335;

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

// Demo aid: the real 3m/30s idle timeout (backend/adapter/AbletonAdapter.ts:24-25) can
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
  // The real backend allows any origin (backend/index.ts:16); the sim only
  // ever serves local dev UIs, so restrict CORS to localhost origins.
  cors: { origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ },
});
httpServer.listen(WS_PORT, '127.0.0.1');

simulator.onEvent(({ eventName, data }) => {
  io.emit(eventName, data);
});

io.on('connection', (socket) => {
  log(`Web client connected (${socket.id})`);
  socket.on('disconnect', () => {
    log(`Web client disconnected (${socket.id})`);
    // Mirrors backend/index.ts: socket.io v4 removes the socket from the
    // namespace before emitting 'disconnect', so size === 0 = last client.
    if (io.of('/').sockets.size === 0) {
      simulator.handleLastWebClientDisconnected();
    }
  });

  const logReceived = (eventName: string, payload?: unknown) => {
    log(`recv ${eventName} ${payload !== undefined ? JSON.stringify(payload) : ''}`);
  };

  // Tag events — websocket variants of /new/tag and /departed/tag
  // (backend/event/IncomingEvents.ts:33-56)
  socket.on('/new/tag', (data: TagDetectionData) => {
    logReceived('/new/tag', data);
    simulator.handleNewTag(data);
  });
  socket.on('/departed/tag', (data: TagDetectionData) => {
    logReceived('/departed/tag', data);
    simulator.handleDepartedTag(data);
  });

  // Ack-style requests (backend/event/IncomingEvents.ts:106-172)
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
  // (backend/event/IncomingEvents.ts:160,173)
  socket.on('set_track_volume', (data: SetTrackVolumeInputType) => {
    logReceived('set_track_volume', data);
    simulator.setTrackVolume(data);
  });
  socket.on('set_master-key', (newKey: string) => {
    logReceived('set_master-key', newKey);
    simulator.setMasterKey(newKey);
  });

  // WOW-007C cauldron sample + settings — mirrors backend/event/IncomingEvents
  // ack shapes exactly (ADR-001 sim parity).
  socket.on('trigger_cauldron_sample', () => {
    logReceived('trigger_cauldron_sample');
    simulator.triggerCauldronSample();
  });
  socket.on('get_cauldron_volume', (_, callback) => {
    logReceived('get_cauldron_volume');
    callback?.(simulator.getCauldronVolume());
  });
  socket.on('set_cauldron_volume', (data: SetCauldronVolumeInputType) => {
    logReceived('set_cauldron_volume', data);
    simulator.setCauldronVolume(data);
  });
  socket.on('get_idle_timeout', (_, callback) => {
    logReceived('get_idle_timeout');
    callback?.(simulator.getIdleTimeoutConfig());
  });
  socket.on('set_idle_timeout', (config: IdleTimeoutConfigType, callback) => {
    logReceived('set_idle_timeout', config);
    callback?.(simulator.setIdleTimeoutConfig(config));
  });

  // WOW-007C item 4: DJ mode active/inactive — no ack, mirrors
  // backend/event/IncomingEvents.ts's set_dj_mode handler exactly.
  socket.on('set_dj_mode', (data: SetDjModeInputType) => {
    logReceived('set_dj_mode', data);
    simulator.setDjModeActive(data);
  });
});

log(`Simulator listening on localhost:${WS_PORT}`);
log(`Scenario: ${scenario.name} — ${scenario.description}`);
runScenario(simulator, scenario, log);
