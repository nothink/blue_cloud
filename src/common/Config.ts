import config from 'config';

class Config {
  private static _instance: config.IConfig;

  /**
   * プロセス全体のLoggerインスタンス
   */
  public static get config(): config.IConfig {
    if (!this._instance) {
      this._instance = config;
    }
    return this._instance;
  }
}

export default Config.config;
