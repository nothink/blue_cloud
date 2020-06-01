import Puppet from '@/common/Puppet';

import { ChampionshipPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class ResultPhase extends ChampionshipPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.skipResult();
  }

  /**
   *  戦闘結果画面をスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async skipResult(): Promise<void> {
    const selector = '.btnPrimary.jsTouchActive';
    try {
      const button = await Puppet.page.$(selector);
      if (button) {
        await button.click();
      }
    } catch (e) {
      // ボタンなしは無視していい
      return;
    }
  }
}
