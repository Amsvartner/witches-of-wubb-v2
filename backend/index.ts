import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve('..', '.env') });
import * as socketio from 'socket.io';
import { AbletonAdapter } from './adapter/AbletonAdapter';
import { Logger } from './util/Logger';
import * as nodeOSC from 'node-osc';

const wsPort: number = parseInt(process.env.WS_SEVER_PORT as string, 10);
const oscPort: number = parseInt(process.env.OSC_SERVER_PORT as string, 10);

// Races against a bare, ableton-js-independent timer, not against the
// library's own per-command timeout: ableton-js's handleDisconnect cancels
// in-flight commands' timeouts on disconnect without ever rejecting them, so
// a command in flight at that exact moment hangs forever at the library
// layer. This outer race is what actually bounds the exit in that case.
const CRASH_EXIT_STOP_TIMEOUT_MS = 1500;
let isCrashExiting = false;

async function crashExit(err: unknown, message: string) {
  if (isCrashExiting) {
    Logger.error(
      err,
      `${message} (crash exit already in progress, skipping duplicate stop attempt)`,
    );
    return;
  }
  isCrashExiting = true;
  Logger.error(err, message);
  await Promise.race([
    AbletonAdapter.stopAllClipsBestEffort(),
    new Promise((resolve) => setTimeout(resolve, CRASH_EXIT_STOP_TIMEOUT_MS)),
  ]);
  process.exit(1);
}

process.on('unhandledRejection', (reason) => {
  crashExit(reason, 'Unhandled promise rejection').catch(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  crashExit(err, 'Uncaught exception').catch(() => process.exit(1));
});

async function main() {
  await AbletonAdapter.startAbleton();
  Logger.info(`Websocket server is listening on localhost:${wsPort}`);
  const io: socketio.Server = new socketio.Server(wsPort, {
    cors: { origin: true },
  });
  const oscServer: nodeOSC.Server = new nodeOSC.Server(oscPort, '0.0.0.0');

  io.on('connection', (s: socketio.Socket) => {
    Logger.info('Web client connected');

    s.on('disconnect', () => {
      Logger.info('Web client disconnected');
    });
    AbletonAdapter.addWebSocket(s);
  });

  oscServer.on('listening', function () {
    Logger.info(`OSC Server is listening on localhost:${oscPort}`);
    AbletonAdapter.connectOscServer(oscServer);
  });

  oscServer.on('message', function (msg, rinfo) {
    Logger.trace(`OSC message: ${msg} from address: ${rinfo.address}`);
  });
}

main().catch((err) => {
  Logger.error(err, 'Fatal error during backend startup');
  process.exit(1);
});
