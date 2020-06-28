import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(PointAnimation画面)
 */
export default class PointAnimationPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.passPointAnimation();
  }

  /**
   *  ポイント取得アニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passPointAnimation(): Promise<void> {
    const canvas = await Puppet.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      const mouse = await Puppet.page.mouse;
      if (canvasBox && mouse) {
        // 座標をクリック
        await mouse.click(canvasBox.x + 160, canvasBox.y + 250);
      }
    }
  }
}
