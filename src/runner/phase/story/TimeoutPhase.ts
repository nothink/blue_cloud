import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(Timeout画面)
 */
export default class TimeoutPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.passTimeout();
  }

  /**
   * タイムアウト画面をスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async passTimeout(): Promise<void> {
    // reloadだと同じページに行ってしまうらしい
    const button = await Puppet.page.$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }
}
