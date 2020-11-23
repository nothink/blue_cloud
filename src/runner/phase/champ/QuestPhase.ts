import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import { ChampionshipPhase } from '../../base/PhaseBase';
import Utils from './utils';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class QuestPhase extends ChampionshipPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.walk();
  }

  /**
   *  カリスマのエリア歩行
   *  @returns 空のpromiseオブジェクト
   */
  private async walk(): Promise<void> {
    // ボタン存在可否
    const button = await Puppet.page.$('#js_btnFight');
    while (button) {
      // ダイアログが表示されている場合飛ばす
      await this.passDialog();

      // 「さがす」ボタンのクリック可否性チェック
      let clickable: boolean;
      try {
        clickable = await Puppet.page.$eval('#js_btnFight', (item: Element) => {
          const cls = item.getAttribute('class') || '';
          if (cls.includes('btnFightOn')) {
            return true;
          }
          return false;
        });
      } catch (e) {
        // コンテキスト不在になった時は突然の画面遷移なので次に進む
        return;
      }
      if (clickable) {
        const buttonBox = await button.boundingBox();
        if (!buttonBox) {
          logger.warn('Unclickable (walk button)');
          return;
        }
        await Puppet.page.mouse.click(buttonBox.x + 12, buttonBox.y + 12);

        const status = await Promise.all([
          Utils.GetHearts(),
          this.getCurrentScene(),
        ]);
        // ゲージ満タンかのチェック
        const life = status[0];
        const scene = status[1];
        // アピールタイムで目標のライフを確保したかチェック
        const appealIcon = await Puppet.page.$('.js_appealTime');
        if (appealIcon) {
          if (
            (scene === 'user' && life > 1) ||
            (scene === 'boss' && life === 5)
          ) {
            const iconBox = await appealIcon.boundingBox();
            if (!iconBox) {
              logger.warn('Unclickable (appeal button)');
              return;
            }
            await Puppet.page.mouse.click(iconBox.x + 7, iconBox.y + 7);
            return;
          }
        }
      } else {
        // 0.01秒待機
        // await Puppet.page.waitForTimeout(10);
      }
    }
  }

  // --------------------------------- utils ---------------------------------

  /**
   *  バー補給ダイアログの有無をチェックし、
   *  表示されている場合はバーを利用してスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async passDialog(): Promise<void> {
    // スタミナ不足ダイアログの可否をチェック
    const display = await Puppet.page.$eval('#outStamina', (item: Element) => {
      const style = item.getAttribute('style') || '';
      if (style.includes('block')) {
        return true;
      }
      return false;
    });
    if (!display) {
      return;
    }

    const buttons = await Puppet.page.$$('#outStamina a.btnShadow');
    while (buttons.length > 0) {
      const button = buttons.shift();
      if (button) {
        const title = await Puppet.page.evaluate((item: Element) => {
          return item.textContent;
        }, button);
        if (title === '使用する') {
          const buttonBox = await button.boundingBox();
          // 座標をクリック
          if (buttonBox) {
            await Puppet.page.mouse.click(buttonBox.x + 80, buttonBox.y + 20);
            const confirm = await Puppet.page.$('#confirmPopOkBtn');
            if (confirm) {
              const confirmBox = await confirm.boundingBox();
              if (confirmBox) {
                await Puppet.page.mouse.click(
                  confirmBox.x + 80,
                  confirmBox.y + 20
                );
                return;
              }
            }
          }
        }
      }
    }
    return;
  }

  /**
   *  アピールタイムに突入しているかどうかを確認して、
   *  どのアピールシーンかチェックする
   *  (走行中のみ)
   *  @returns stringのPromise (boss/user)かundefined
   */
  private async getCurrentScene(): Promise<string> {
    if (await Puppet.page.$('.js_appealTime')) {
      const scene = await Puppet.page.$eval(
        '.js_appealTime',
        (item: Element) => {
          const href = (item as HTMLAnchorElement).href;
          if (href.includes('boss')) {
            return Promise.resolve('boss');
          }
          if (href.includes('user')) {
            return Promise.resolve('user');
          }
          return '';
        }
      );
      return scene;
    }
    return Promise.resolve('');
  }
}
