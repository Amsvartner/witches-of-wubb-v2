import { Logger, LogLevelName } from '~/util/Logger';

// Logger is a singleton wrapping a js-logger instance (JsLogger.get('App')). These
// tests exercise its string-based level API and the debug on/off helpers directly.
describe('Logger', () => {
  it('exposes the standard logging methods', () => {
    expect(typeof Logger.debug).toBe('function');
    expect(typeof Logger.info).toBe('function');
    expect(typeof Logger.warn).toBe('function');
    expect(typeof Logger.error).toBe('function');
    expect(typeof Logger.setLevel).toBe('function');
  });

  it('sets the level from a level-name string (no js-logger constants needed)', () => {
    const cases: LogLevelName[] = ['trace', 'debug', 'info', 'warn', 'error'];
    cases.forEach((name) => {
      Logger.setLevel(name);
      expect(Logger.getLevel().name).toBe(name.toUpperCase());
    });
  });

  it('maps the special "time" and "off" levels correctly', () => {
    Logger.setLevel('time');
    expect(Logger.getLevel().name).toBe('TIME');

    Logger.setLevel('off');
    expect(Logger.getLevel().name).toBe('OFF');
  });

  it('does not recurse when setLevel is called repeatedly', () => {
    expect(() => {
      Logger.setLevel('debug');
      Logger.setLevel('info');
      Logger.setLevel('debug');
    }).not.toThrow();
    expect(Logger.getLevel().name).toBe('DEBUG');
  });

  it('enableDebug/disableDebug toggle the level', () => {
    Logger.enableDebug();
    expect(Logger.getLevel().name).toBe('DEBUG');

    Logger.disableDebug();
    expect(Logger.getLevel().name).toBe('INFO');
  });
});
