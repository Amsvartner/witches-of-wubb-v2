import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve('..', '.env') });
import * as socketio from 'socket.io';
import { AbletonAdapter } from './adapter/AbletonAdapter';
import { Logger } from './util/Logger';
import * as nodeOSC from 'node-osc';

const wsPort: number = parseInt(process.env.WS_SEVER_PORT as string, 10);
const oscPort: number = parseInt(process.env.OSC_SERVER_PORT as string, 10);

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

main();
