import { ChampionshipPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class BattleAnimationPhase extends ChampionshipPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.skipAnimation();
  }

  /**
   *  戦闘アニメーションをリロードしてスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async skipAnimation(): Promise<void> {
    await this.runner.redo();
  }
}
