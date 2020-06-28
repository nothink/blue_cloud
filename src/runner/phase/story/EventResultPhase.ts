import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(EventResult画面)
 */
export default class EventResultPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.checkEventResult();
  }

  /**
   *  イベント終了時の画面を閉じてふむふむ画面に戻る
   *  @returns 空のpromiseオブジェクト
   */
  private async checkEventResult(): Promise<void> {
    const button = await Puppet.page.$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }
}
