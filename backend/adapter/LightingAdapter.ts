import * as nodeOSC from 'node-osc';
import { LoggerUtil } from '../util/LoggerUtil';
import { OutgoingEventData } from '../type/OutgoingEventData';

const logger = LoggerUtil.logger;

const LIGHTING_SERVER_ADDRESS = process.env.LIGHTING_SERVER_ADDRESS as string;
const LIGHTING_SERVER_PORT = Number(process.env.LIGHTING_SERVER_PORT as string);
const lightingClient = new nodeOSC.Client(LIGHTING_SERVER_ADDRESS, LIGHTING_SERVER_PORT);

function sendOscMessage(address: string, data?: OutgoingEventData) {
  const message = new nodeOSC.Message(address);

  if (data?.type) {
    message.append(data.type);
  }

  lightingClient.send(message, (err) => {
    if (err) logger.error(err);
  });
}

export const LightingAdapter = {
  sendOscMessage,
};
