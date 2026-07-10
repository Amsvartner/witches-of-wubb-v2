import { AbletonAdapter } from '../adapter/AbletonAdapter';
import { LightingAdapter } from '../adapter/LightingAdapter';
import { LoggerUtil } from '../util/LoggerUtil';

const logger = LoggerUtil.logger;

function emit(eventName: string, data?: Record<any, any>) {
  logger.debug(`Emitting event ${eventName} with data: ${JSON.stringify(data)}`);
  AbletonAdapter.sockets?.forEach((socket) => {
    socket?.emit(eventName, data);
  });
  if (data?.pillar > -1) {
    const pillar = data?.pillar + 1;
    LightingAdapter.sendOscMessage(`/${pillar}/${eventName}`, data);
  } else {
    LightingAdapter.sendOscMessage(`/${eventName}`, data);
  }
}

function emitEventWithoutResetingTimout(eventName: string, data?: Record<any, any>) {
  emit(eventName, data);
}

function emitEvent(eventName: string, data?: Record<any, any>) {
  AbletonAdapter.restartTimeoutTimer();
  emit(eventName, data);
}

export const OutgoingEvents = {
  emitEvent,
  emitEventWithoutResetingTimout,
};
