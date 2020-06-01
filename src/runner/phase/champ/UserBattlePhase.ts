import Puppet from '@/common/Puppet';

import { ChampionshipPhase } from '../../base/PhaseBase';
import Utils from './utils';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class UserBattlePhase extends ChampionshipPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.userBattle();
  }

  /**
   *  対ユーザバトル処理
   *  @returns 空のpromiseオブジェクト
   */
  private async userBattle(): Promise<void> {
    const mySel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > \
        div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatLeft.half > \
        p:nth-child(2)';
    const tgtSel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > \
        div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatRight.half.textRight > \
        p:nth-child(2)';
    const status = await Promise.all([
      Puppet.page.$eval(mySel, (item: Element) => {
        return Number(item.textContent);
      }),
      Puppet.page.$eval(tgtSel, (item: Element) => {
        return Number(item.textContent);
      }),
      Utils.GetHearts(),
    ]);

    const myAttack = status[0];
    const tgtAttack = status[1];
    const hearts = status[2];
    // ライフ消費は、自分の攻が相手の1.0.5倍だったら1つ、それ以外は2とする
    const needLife = myAttack > tgtAttack * 1.05 ? 1 : 2;
    if (hearts < needLife) {
      // エリアに戻る
      this.runner.goHome();
      return;
    }
    const buttonDivs = await Puppet.page.$$('.js_heartSelectionBtn');
    const button = buttonDivs[needLife - 1];
    const buttonBox = await button.boundingBox();
    if (buttonBox) {
      await Puppet.page.mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }
  }
}
