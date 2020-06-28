import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(EventAnimation画面)
 */
export default class EventAnimationPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.passEventAnimation();
  }

  /**
   *  差し入れ時のイベントアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passEventAnimation(): Promise<void> {
    const canvas = await Puppet.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      const mouse = await Puppet.page.mouse;
      if (canvasBox && mouse) {
        // 座標をクリック
        await mouse.click(canvasBox.x + 300, canvasBox.y + 400);
      }
    }
  }
}
