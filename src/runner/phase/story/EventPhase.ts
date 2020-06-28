import Puppet from '@/common/Puppet';

import { StoryPhase } from '../../base/PhaseBase';

/**
 * ふむふむ用のランナーフェイズ(Quest画面)
 */
export default class EventPhase extends StoryPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.selectEventItem();
  }

  /**
   *  差し入れアイテムのボタンをいずれか押す
   *  @returns 空のpromiseオブジェクト
   */
  private async selectEventItem(): Promise<void> {
    // ラブラブタイムの時間を取りに行き、取れたら保持
    // 取れなかったらラブラブタイム以外
    let sec = 0;
    let isLoveLove: boolean;
    try {
      const area = await Puppet.page.$('.loveloveModeTime');
      const timestr = await Puppet.page.evaluate((elem) => {
        return elem.textContent;
      }, area);
      const times = timestr.split(':');
      sec = parseInt(times[0], 10) * 60 + parseInt(times[1], 10);
      isLoveLove = true;
    } catch (e) {
      isLoveLove = false;
    }
    // フィーバー（ラブラブ差し入れ）かのチェック
    const isFever = await Puppet.page.$eval('h1', (elem) => {
      return elem.getAttribute('class') === 'eventFeverTitle';
    });

    if (isLoveLove && isFever && sec < 15 && this.runner.usingSpecial) {
      await Puppet.page.waitFor((sec + 5) * 1000);
      const item = await Puppet.page.$('#js_openItemPopup');
      if (item) {
        await item.click();
      }
      await Puppet.page.waitFor(100);
      const confirm = await Puppet.page.$(
        '#js_specialItemButton.jsTouchActive'
      );
      if (confirm) {
        return confirm.click();
      }
      // ボタンがjsTouchActiveでないときは以降続行
      const close = await Puppet.page.$('.closePopBtn');
      if (close) {
        await close.click();
        return this.runner.redo();
      }
    } else {
      const button = await Puppet.page.$('#js_normalItemButton');
      if (button) {
        return button.click();
      }
    }
  }
}
