import Puppet from '@/common/Puppet';

import { ChampionshipPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class EncountPhase extends ChampionshipPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.skipEncount();
  }

  /**
   *  遭遇画面（ユーザ、アピール）をスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async skipEncount(): Promise<void> {
    const canvas = await Puppet.page.$('#canvas');
    try {
      while (canvas) {
        // canvasが無くなるまでクリック
        await canvas.click();
        await Puppet.page.waitFor(50);
      }
    } catch (e) {
      // canvas不在でここにくる
      return;
    }
  }
}
