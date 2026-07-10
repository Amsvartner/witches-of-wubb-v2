import JsLogger from 'js-logger';
import type { ILogger, ILogLevel } from 'js-logger';

export type LogLevelName = 'trace' | 'debug' | 'info' | 'time' | 'warn' | 'error' | 'off';

type AppLogger = Omit<ILogger, 'setLevel'> & {
  setLevel: (level: LogLevelName) => void;
  enableDebug: () => void;
  disableDebug: () => void;
};

const LEVEL_BY_NAME: Record<LogLevelName, ILogLevel> = {
  trace: JsLogger.TRACE,
  debug: JsLogger.DEBUG,
  info: JsLogger.INFO,
  time: JsLogger.TIME,
  warn: JsLogger.WARN,
  error: JsLogger.ERROR,
  off: JsLogger.OFF,
};

const createLogger = (): AppLogger => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  JsLogger.useDefaults();

  const jsLogger = JsLogger.get('App');

  // Capture the native setLevel (which takes an ILogLevel) before we override it,
  // so consumers can pass a level-name string (e.g. 'debug') and never need to
  // import js-logger or its level constants. Capturing first prevents recursion.
  const setNativeLevel = jsLogger.setLevel.bind(jsLogger);

  const logger = jsLogger as unknown as AppLogger;
  logger.setLevel = (level: LogLevelName) => setNativeLevel(LEVEL_BY_NAME[level]);

  logger.enableDebug = () => {
    logger.info('Enabling debug mode');
    logger.setLevel('debug');
  };

  logger.disableDebug = () => {
    logger.info('Disabling debug mode');
    logger.setLevel('info');
  };

  logger.setLevel('debug');

  return logger;
};

export const Logger = createLogger();
