import bunyan from 'bunyan';

class Logger {
  private static _instance: bunyan;

  /**
   * プロセス全体のLoggerインスタンス
   */
  public static get logger(): bunyan {
    if (!this._instance) {
      this._instance = bunyan.createLogger({
        level: 'info',
        name: 'blue_cloud',
        stream: process.stdout,
      });
    }
    return this._instance;
  }
}

export default Logger.logger;
