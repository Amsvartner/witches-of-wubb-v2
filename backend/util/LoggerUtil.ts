import pino from 'pino';
const logger = pino({
  level: 'info',
});
export const LoggerUtil = {
  logger,
};
