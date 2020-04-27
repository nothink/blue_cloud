import RunnerBase from './base/RunnerBase';

import url from 'url';

/**
 * ふむふむ（聖櫻学園物語）用のランナースクリプト
 */
export default class StoryRunner extends RunnerBase {
  protected homeUrl!: string;

  private eventId!: number;
  private questId!: number;
  private usingSpecial!: boolean;

  /**
   *  コンストラクタ
   */
  constructor() {
    super();

    this.eventId = this.config.get('story.eventId');
    this.questId = this.config.get('story.questId');
    this.usingSpecial = this.config.get('story.usingSpecial');

    // ふむふむホーム（ふむふむの基準ページは、イベントIDとクエストIDに依存する）
    this.homeUrl =
      `${this.config.get('storyHomeUrlBase')}` +
      `?eventId=${this.eventId}&questId=${this.questId}`;
  }

  /**
   *  現在の状態
   *  @returns    状態を表す文字列
   *      quest: ふむふむ状態
   *          (http://vcard.ameba.jp/story/quest?eventId=37&questId=3)
   *      discovery-animation: 差し入れタイム開始
   *          (http://vcard.ameba.jp/story/quest/discovery-animation?
   *              eventId=37&questId=3&stageId=6&type=0&token=OPOu6v)
   *      event: 差し入れ選択
   *          (http://vcard.ameba.jp/story/quest/event?eventId=37&questId=3)
   *      event-animation: 差し入れ結果
   *          (http://vcard.ameba.jp/story/quest/event-animation?
   *              eventId=37&questId=3&token=n2YDGc)
   *      levelup-animation (確認中) : レベルアップアニメーション
   *      point-animation (確認中) : ポイント取得アニメーション
   *      event-result: リザルト画面
   *          (http://vcard.ameba.jp/story/quest/event-result?
   *              eventId=37&questId=3)
   *      timeout: 差し入れタイム終了状態画面
   *      animation: ふむふむ本シナリオ
   */
  get phase(): string {
    const current = url.parse(this.page.url());
    if (!current || !current.pathname || current.pathname === '/') {
      // 初回、ないしは該当なしの場合は空ステータス
      return '';
    }
    const fragms = current.pathname.split('/');
    // 基本的にfragmentの末尾で判定するためpop()
    const ftail = fragms.pop() || '';
    return ftail;
  }

  /**
   *  ループ実行の一単位 (override)
   *  @returns 空のpromiseオブジェクト
   */
  protected async runOnce(): Promise<void> {
    // Phaseで切り替える
    switch (this.phase) {
      case '':
        return this.goHome();
      case 'quest':
        return this.listenQuest();
      case 'discovery-animation':
        return this.passDiscoveryAnimation();
      case 'event':
        return this.selectEventItem();
      case 'event-animation':
        return this.passEventAnimation();
      case 'levelup-animation':
        return this.passLevelupAnimation();
      case 'point-animation':
        return this.passPointAnimation();
      case 'event-result':
        return this.checkEventResult();
      case 'timeout':
        // reloadだと同じページに行ってしまうらしい
        return this.passTimeout();
      case 'animation':
        return this.goHome();

      default:
        await this.page.waitFor(300);
        this.logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
  }

  /**
   *  ふむふむボタンを押す
   *  @returns 空のpromiseオブジェクト
   */
  private async listenQuest(): Promise<void> {
    // ダイアログが表示されている場合飛ばす
    const usedBar = await this.isDisplayedDialog();
    if (usedBar) {
      // バー利用直後は再判定
      return;
    }
    await this.page.waitFor(500);

    try {
      const button = await this.page.$('.questTouchArea');
      if (button) {
        const buttonBox = await button.boundingBox();
        if (buttonBox) {
          // 座標をクリック
          const mouse = await this.page.mouse;
          await mouse.click(buttonBox.x + 280, buttonBox.y + 280);
        } else {
          // エリア取得失敗時はリロード
          this.redo();
        }
      }
    } catch (e) {
      this.logger.debug('going discovery animation...');
      await this.page.waitFor(1000);
    }
  }

  /**
   *  差し入れタイムのアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passDiscoveryAnimation(): Promise<void> {
    // このアニメーションは遷移終了まで待たないとエラーに飛ぶ
    try {
      await this.browser.waitForTarget(
        (target) => url.parse(target.url()).pathname === '/story/quest/event',
        { timeout: 5000 }
      );
    } catch (e) {
      this.logger.debug('unknown path?');
    }
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
      const area = await this.page.$('.loveloveModeTime');
      const timestr = await this.page.evaluate((elem) => {
        return elem.textContent;
      }, area);
      const times = timestr.split(':');
      sec = parseInt(times[0], 10) * 60 + parseInt(times[1], 10);
      isLoveLove = true;
    } catch (e) {
      isLoveLove = false;
    }
    // フィーバー（ラブラブ差し入れ）かのチェック
    const isFever = await this.page.$eval('h1', (elem) => {
      return elem.getAttribute('class') === 'eventFeverTitle';
    });

    if (isLoveLove && isFever && sec < 15 && this.usingSpecial) {
      await this.page.waitFor((sec + 5) * 1000);
      const item = await this.page.$('#js_openItemPopup');
      if (item) {
        await item.click();
      }
      await this.page.waitFor(200);
      const confirm = await this.page.$('#js_specialItemButton.jsTouchActive');
      if (confirm) {
        return confirm.click();
      }
      // ボタンがjsTouchActiveでないときは以降続行
      const close = await this.page.$('.closePopBtn');
      if (close) {
        await close.click();
        return this.redo();
      }
    } else {
      const button = await this.page.$('#js_normalItemButton');
      if (button) {
        return button.click();
      }
    }
  }

  /**
   *  差し入れ時のイベントアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passEventAnimation(): Promise<void> {
    const canvas = await this.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      const mouse = await this.page.mouse;
      if (canvasBox && mouse) {
        // 座標をクリック
        await mouse.click(canvasBox.x + 300, canvasBox.y + 400);
      }
    }
  }

  /**
   *  イベントレベルアップアニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passLevelupAnimation(): Promise<void> {
    await this.page.waitFor(300);
    try {
      const canvas = await this.page.$('#canvas');
      // TODO: ボタン飛ばし入れる？
      if (canvas) {
        const canvasBox = await canvas.boundingBox();
        const mouse = await this.page.mouse;
        if (canvasBox && mouse) {
          // 座標をクリック
          await mouse.click(canvasBox.x + 210, canvasBox.y + 265);
        }
      }
    } catch (e) {
      this.logger.debug('unclickable canvas?');
      await this.page.waitFor(300);
    }
  }

  /**
   *  ポイント取得アニメーションを飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passPointAnimation(): Promise<void> {
    const canvas = await this.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      const mouse = await this.page.mouse;
      if (canvasBox && mouse) {
        // 座標をクリック
        await mouse.click(canvasBox.x + 160, canvasBox.y + 250);
      }
    }
  }

  /**
   *  イベント終了時の画面を閉じてふむふむ画面に戻る
   *  @returns 空のpromiseオブジェクト
   */
  private async checkEventResult(): Promise<void> {
    const button = await this.page.$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }

  /**
   * タイムアウト画面をスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async passTimeout(): Promise<void> {
    const button = await this.page.$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }

  /**
   *  中断ダイアログが表示されているかどうかをチェックして
   *  もし表示されていたらダイアログを飛ばす
   *  @returns true: ダイアログが表示されている / false: ダイアログなし
   */
  private async isDisplayedDialog(): Promise<boolean> {
    // 中断ダイアログの可否をチェック
    try {
      const popupSel = '.popup#outStamina';
      if (await this.page.$(popupSel)) {
        const display = await this.page.$eval(popupSel, (item: Element) => {
          const style = item.getAttribute('style') || '';
          if (style.includes('block')) {
            return true;
          }
          return false;
        });
        if (!display) {
          // ダイアログ非表示
          return Promise.resolve(false);
        }
      }
    } catch (e) {
      // ダイアログ要素そのものが無い場合はページ違い
      return Promise.resolve(false);
    }

    const buttons = await this.page.$$('#outStamina a.btnShadow');
    while (buttons.length > 0) {
      const button = buttons.shift();
      if (!button) {
        continue;
      }
      const title = await this.page.evaluate((item: Element) => {
        return item.textContent;
      }, button);
      if (title === '使用する') {
        const buttonBox = await button.boundingBox();
        // 座標をクリック
        const mouse = await this.page.mouse;
        if (buttonBox) {
          await mouse.click(buttonBox.x + 80, buttonBox.y + 20);
          const confirm = await this.page.$('#confirmPopOkBtn');
          if (confirm) {
            const confirmBox = await confirm.boundingBox();
            if (confirmBox) {
              await mouse.click(confirmBox.x + 80, confirmBox.y + 20);
              return Promise.resolve(true);
            }
          }
        }
      }
    }
    return Promise.resolve(false);
  }
}
