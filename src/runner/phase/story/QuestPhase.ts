import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(Quest画面)
 */
export default class QuestPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.listenQuest();
  }

  /**
   *  ふむむふボタンを例外が出るまで押し続ける
   *  @returns 空のpromiseオブジェクト
   */
  private async listenQuest(): Promise<void> {
    try {
      while (false === (await this.hasCanvas())) {
        await this.clickFmfm();
      }
    } catch (e) {
      // ページ違いの時は総じて例外が飛ぶ / 例外を飛ばしている
      await Puppet.page.waitFor(360);
      return;
    }
  }

  /**
   *  ふむふむボタンを押す
   *  @returns 空のpromiseオブジェクト
   */
  private async clickFmfm(): Promise<void> {
    // バー利用ダイアログを飛ばす
    await this.skipDialog();
    // wait

    // ボタンクリック.
    const buttonSel =
      '#enchant-stage div[style*="https://dqx9mbrpz1jhx.cloudfront.net/vcard/ratio20/images/story/common/quest/detail/detail_aha_balloon.png"]';
    const button = await Puppet.page.waitForSelector(buttonSel, {
      timeout: 820,
    });
    if (button) {
      const buttonBox = await button.boundingBox();
      if (buttonBox) {
        // 座標をクリック
        const mouse = await Puppet.page.mouse;
        await mouse.click(buttonBox.x + 16, buttonBox.y + 16);
      } else {
        // エリア取得失敗時は押せない状態
        await Puppet.page.waitFor(160);
      }
      await Puppet.page.waitFor(180);
    }
  }

  /**
   *  中断ダイアログが表示されているかどうかをチェックして
   *  もし表示されていたらダイアログを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async skipDialog(): Promise<void> {
    // 中断ダイアログの可否をチェック
    try {
      const popupSel = '.popup#outStamina';
      if (await Puppet.page.$(popupSel)) {
        const display = await Puppet.page.$eval(popupSel, (item: Element) => {
          const style = item.getAttribute('style') || '';
          if (style.includes('block')) {
            return true;
          }
          return false;
        });
        if (!display) {
          // ダイアログ非表示
          return;
        }
      }
    } catch (e) {
      // ダイアログ要素そのものが無い場合はページ違い
      // この例外をキャッチしてページ判定に持っていく
      throw e;
    }

    // ダイアログスキップ処理
    const buttons = await Puppet.page.$$('#outStamina a.btnShadow');
    while (buttons.length > 0) {
      const button = buttons.shift();
      if (!button) {
        continue;
      }
      const title = await Puppet.page.evaluate((item: Element) => {
        return item.textContent;
      }, button);
      if (title === '使用する') {
        const buttonBox = await button.boundingBox();
        // 座標をクリック
        const mouse = await Puppet.page.mouse;
        if (buttonBox) {
          await mouse.click(buttonBox.x + 80, buttonBox.y + 20);
          const confirm = await Puppet.page.$('#confirmPopOkBtn');
          if (confirm) {
            const confirmBox = await confirm.boundingBox();
            if (confirmBox) {
              await mouse.click(confirmBox.x + 80, confirmBox.y + 20);
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Canvasが存在するかどうか
   *  @returns true: canvas要素あり / false: canvas要素あり
   */
  private async hasCanvas(): Promise<boolean> {
    const canvas = await Puppet.page.$('canvas');
    return canvas ? true : false;
  }
}
