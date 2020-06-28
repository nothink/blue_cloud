import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

import url from 'url';

/**
 * ふむふむ用のランナーフェイズ(DiscoveryAnimation画面)
 */
export default class DiscoveryAnimationPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.passDiscoveryAnimation();
  }

  /**
   *  差し入れタイムのアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passDiscoveryAnimation(): Promise<void> {
    // このアニメーションは遷移終了まで待たないとエラーに飛ぶ
    try {
      await Puppet.browser.waitForTarget(
        (target) => url.parse(target.url()).pathname === '/story/quest/event',
        { timeout: 7800 }
      );
    } catch (e) {
      logger.debug('unknown path?');
    }
  }
}
