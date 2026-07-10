import { AbletonAdapter } from '../adapter/AbletonAdapter';
import { LightingAdapter } from '../adapter/LightingAdapter';
import { LoggerUtil } from '../util/LoggerUtil';
import { OutgoingEventData } from '../type/OutgoingEventData';

const logger = LoggerUtil.logger;

function emit(eventName: string, data?: OutgoingEventData) {
  logger.debug(`Emitting event ${eventName} with data: ${JSON.stringify(data)}`);
  AbletonAdapter.sockets?.forEach((socket) => {
    socket?.emit(eventName, data);
  });
  if ((data?.pillar as number) > -1) {
    const pillar = (data?.pillar as number) + 1;
    LightingAdapter.sendOscMessage(`/${pillar}/${eventName}`, data);
  } else {
    LightingAdapter.sendOscMessage(`/${eventName}`, data);
  }
}

function emitEventWithoutResetingTimout(eventName: string, data?: OutgoingEventData) {
  emit(eventName, data);
}

function emitEvent(eventName: string, data?: OutgoingEventData) {
  AbletonAdapter.restartTimeoutTimer();
  emit(eventName, data);
}

export const OutgoingEvents = {
  emitEvent,
  emitEventWithoutResetingTimout,
};
