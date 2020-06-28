import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(LevelupAnimation画面)
 */
export default class LevelupAnimationPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.passLevelupAnimation();
  }

  /**
   *  イベントレベルアップアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passLevelupAnimation(): Promise<void> {
    await Puppet.page.waitFor(100);
    try {
      const canvas = await Puppet.page.$('#canvas');
      // TODO: ボタン飛ばし入れる？
      if (canvas) {
        const canvasBox = await canvas.boundingBox();
        const mouse = await Puppet.page.mouse;
        if (canvasBox && mouse) {
          // 座標をクリック
          await mouse.click(canvasBox.x + 210, canvasBox.y + 265);
        }
      }
    } catch (e) {
      await Puppet.page.waitFor(100);
    }
  }
}
