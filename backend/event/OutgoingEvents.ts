import { AbletonAdapter } from '../adapter/AbletonAdapter';
import { LightingAdapter } from '../adapter/LightingAdapter';
import { Logger } from '../util/Logger';
import { OutgoingEventData } from '../type/OutgoingEventData';

function emit(eventName: string, data?: OutgoingEventData) {
  Logger.debug(`Emitting event ${eventName} with data: ${JSON.stringify(data)}`);
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

function emitEventWithoutResettingTimeout(eventName: string, data?: OutgoingEventData) {
  emit(eventName, data);
}

function emitEvent(eventName: string, data?: OutgoingEventData) {
  AbletonAdapter.restartTimeoutTimer();
  emit(eventName, data);
}

export const OutgoingEvents = {
  emitEvent,
  emitEventWithoutResettingTimeout,
};
