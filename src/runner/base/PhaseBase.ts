import RunnerBase from './RunnerBase';

/**
 *  Puppeteerを用いたランナースクリプトの
 *  単一の段階(単一URL遷移)で行う処理単位
 */
export default abstract class PhaseBase {
  runner!: RunnerBase;

  /**
   *  コンストラクタ
   */
  constructor(runner: RunnerBase) {
    this.runner = runner;
  }

  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  async abstract proceed(): Promise<void>;
}
