import config from '@/common/Config';
import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import RunnerBase from './base/RunnerBase';

import fs from 'fs';
import url from 'url';

/**
 *  カリスマ決定戦用のランナースクリプト
 */
export default class RaidwarRunner extends RunnerBase {
  // TODO: まだ何も実装してない
  // TODO: 下はデッドなコピペ
  protected homeUrl!: string;

  // private usingCandy!: boolean;
  private expected!: number;

  /**
   *  コンストラクタ
   */
  constructor() {
    super();

    // ハンターズホーム
    this.homeUrl = config.get('raidwarHomeUrl');
  }

  /**
   *  現在の状態
   *  @returns    状態を表す文字列
   *      quest: クエストエリア
   *          (https://vcard.ameba.jp/championship/quest/detail)
   *      encount-animation: エンカウントアニメーション
   *          (https://vcard.ameba.jp/championship/battle/
   *              user/encount-animation?battleId=5471695_1_1553701704104)
   *          (https://vcard.ameba.jp/championship/battle/
   *              boss/encount-animation?battleId=5471695_1_1553699746854)
   *      user: ユーザアピール
   *          (https://vcard.ameba.jp/championship/battle/
   *              user/detail?battleId=5471695_1_1553696455817)
   *      boss: ボスアピール
   *          (https://vcard.ameba.jp/championship/battle/
   *              boss/detail?battleId=5471695_1_1553699746854)
   *      battle-animation: バトルアニメーション
   *          (https://vcard.ameba.jp/championship/battle/
   *              user/battle-animation?useItemFlg=false&
   *              useSmallItemFlg=false&useAp=1&
   *              battleId=5471695_1_1553699227783&token=u8UUNc)
   *          (https://vcard.ameba.jp/championship/battle/
   *              boss/battle-animation?useItemFlg=false&
   *              useSmallItemFlg=false&useAp=1&
   *              battleId=5471695_1_1553704442335&token=Vuoj63&
   *              clubSupport=false)
   *      result: バトル結果画面
   *          (https://vcard.ameba.jp/championship/battle/
   *              user/result?battleId=5471695_1_1553699227783)
   *          (https://vcard.ameba.jp/championship/battle/
   *              boss/result?battleId=5471695_1_1553704442335)
   */
  get phase(): string {
    const current = url.parse(Puppet.page.url());
    if (!current || !current.pathname || current.pathname === '/') {
      // 初回、ないしは該当なしの場合は空ステータス
      return '';
    }
    const fragms = current.pathname.split('/');
    // 基本的にfragmentの末尾で判定するためpop()
    const ftail = fragms.pop() || '';
    if (ftail === 'detail') {
      if (fragms[2] === 'battle') {
        return fragms[3];
      }
      return fragms[2];
    }
    return ftail;
  }

  /**
   *  ループ実行の一単位 (override)
   *  @returns 空のpromiseオブジェクト
   */
  protected async runOnce(): Promise<void> {
    switch (this.phase) {
      case '':
        return this.goHome();
      case 'quest':
        return this.walk();
      case 'encount-animation':
        return this.skipEncount();
      case 'user':
        return this.userBattle();
      case 'boss':
        return this.bossBattle();
      case 'battle-animation':
        return this.skipAnimation();
      case 'result':
        return this.skipResult();
      default:
        await Puppet.page.waitFor(300);
        logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
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
          this.getHearts(),
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
        // await Puppet.page.waitFor(10);
      }
    }
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
      this.getHearts(),
    ]);

    const myAttack = status[0];
    const tgtAttack = status[1];
    const hearts = status[2];
    // ライフ消費は、自分の攻が相手の1.1倍だったら1つ、それ以外は2とする
    const needLife = myAttack > tgtAttack * 1.1 ? 1 : 2;
    if (hearts < needLife) {
      // エリアに戻る
      this.goHome();
      return;
    }
    const buttonDivs = await Puppet.page.$$('.js_heartSelectionBtn');
    const button = buttonDivs[needLife - 1];
    const buttonBox = await button.boundingBox();
    if (buttonBox) {
      await Puppet.page.mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }
  }

  /**
   *  ボスバトル（アピールタイム）処理
   *  @returns 空のpromiseオブジェクト
   */
  private async bossBattle(): Promise<void> {
    const curSel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section.ofHidden > div > \
        div.dropShadow.relative.z1 > div.textCenter.relative.fs12 > \
        span.fcPink.outlineWhite';
    const maxSel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section.ofHidden > div > \
        div.dropShadow.relative.z1 > div.textCenter.relative.fs12 > \
        span:nth-child(2)';
    const status = await Promise.all([
      Puppet.page.$eval(curSel, (item: Element) => {
        const text = item.textContent || '';
        return Number(text.replace(/,/g, ''));
      }),
      Puppet.page.$eval(maxSel, (item: Element) => {
        const text = item.textContent || '';
        return Number(text.substring(1).replace(/,/g, ''));
      }),
      this.getHearts(),
      this.isFullGauge(),
      this.hasBuff(),
      this.isRare(),
      this.getLevel(),
    ]);

    const current = status[0];
    const max = status[1];
    const hearts = status[2];
    const isFullGauge = status[3];
    const hasBuff = status[4];
    const isRare = status[5];
    const level = status[6];

    let needLife = 0;
    if (!this.expected && current === 0) {
      needLife = 1;
    } else {
      if (!this.expected) {
        this.expected = current;
        const tmpPath = `config/${process.env.NODE_ENV}.tmp`;
        fs.writeFileSync(tmpPath, String(this.expected));
      }
      const remain = max - current;
      // バフ発動中は2倍計算
      const exp = hasBuff ? this.expected * 2 : this.expected;
      // レベル6以上のレアは必ず3以上、それ以外は倍数で指定
      if (remain < exp * 0.9 && isRare && level < 7) {
        needLife = 1;
      } else if (remain < exp * 1.8 && isRare && level < 7) {
        needLife = 2;
      } else if (remain < exp * 2.9) {
        needLife = 3;
      } else if (remain < exp * 4.0) {
        needLife = 4;
      } else {
        needLife = 5;
      }
    }
    if (hearts < needLife) {
      this.goHome();
      return;
    }
    if (isFullGauge && !hasBuff && isRare && hearts === 5) {
      // ゲージ満タン, バフ未発動, レア敵、ハート満タンの時はバフ着火ボタンを押す
      const fire = await Puppet.page.$('.js_fireStealth');
      if (fire) {
        const fireBox = await fire.boundingBox();
        if (fireBox) {
          await Puppet.page.mouse.click(fireBox.x + 1, fireBox.y + 1);
          await Puppet.page.waitFor(400);
        }
      }
    }

    const buttonDivs = await Puppet.page.$$('.js_heartSelectionBtn');
    const button = await buttonDivs[needLife - 1];
    const buttonBox = await button.boundingBox();
    if (buttonBox) {
      await Puppet.page.mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }
  }

  /**
   *  戦闘アニメーションをリロードしてスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async skipAnimation(): Promise<void> {
    await this.redo();
  }

  /**
   *  戦闘結果画面をスキップする
   *  @returns 空のpromiseオブジェクト
   */
  private async skipResult(): Promise<void> {
    const selector = '.btnPrimary.jsTouchActive';
    try {
      const button = await Puppet.page.$(selector);
      if (button) {
        await button.click();
      }
    } catch (e) {
      // ボタンなしは無視していい
      return;
    }
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

  /* internal ------------------------------------------------------------ */

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
   *  ライフ（ハート）の数をカウントする
   *  @returns 現在のハートの数のプロミスオブジェクト(0-5)
   */
  private async getHearts(): Promise<number> {
    const hearts = await Puppet.page.$$('.inlineBlock.heartOn.js_heartOn');
    return Promise.resolve(hearts.length);
  }

  /**
   *  アピール相手がレアかどうか
   *  @returns booleanのPromise
   */
  private async getLevel(): Promise<number> {
    const levelSel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section.ofHidden > div > \
        div.dropShadow.relative.z1 > div.table.fill.pt3.pb1 > \
        div.cell.vMiddle.fs12.fcWhite.pl10.textCenter.outlineGreen > \
        p:nth-child(2)';
    try {
      await Puppet.page.waitForSelector(levelSel, { timeout: 300 });
      return Promise.resolve(
        await Puppet.page.$eval(levelSel, (item: Element) => {
          const text = (item as HTMLParagraphElement).textContent || '';
          const m = text.match(/[0-9]*/);
          if (m) {
            return Promise.resolve(Number(m[0]));
          }
          return Promise.resolve(10);
        })
      );
    } catch (e) {
      // セレクタが存在しない時はとりあえず倒しづらくなる10を返す
      return Promise.resolve(10);
    }
  }

  /**
   *  アピール相手がレアかどうか
   *  @returns booleanのPromise
   */
  private async isRare(): Promise<boolean> {
    const rareSel =
      'body > div.gfContentBgFlower > div > div > div > \
        div.gfOutlineFrame > div > section.ofHidden > div > \
        div.dropShadow.relative.z1 > div.table.fill.pt3.pb1 > \
        div:nth-child(1) > img';
    try {
      await Puppet.page.waitForSelector(rareSel, { timeout: 300 });
      return Promise.resolve(
        await Puppet.page.$eval(rareSel, (item: Element) => {
          const src = (item as HTMLImageElement).src;
          if (src.includes('icon_rare')) {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        })
      );
    } catch (e) {
      // セレクタが存在しない時は通常
      return Promise.resolve(false);
    }
  }

  /**
   *  テンションゲージがMAXになっているかどうか
   *  @returns booleanのPromise
   */
  private async isFullGauge(): Promise<boolean> {
    if (await Puppet.page.$('.gaugeFullAnime')) {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  /**
   *  バフが発動中かどうか
   *  @returns booleanのPromise
   */
  private async hasBuff(): Promise<boolean> {
    if (await Puppet.page.$('.js_attackBuff')) {
      return Puppet.page.$eval('.js_attackBuff', (item) => {
        const cls = item.getAttribute('class') || '';
        if (cls.includes('none')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
    }
    // ここはこれで正しいのか？
    return Promise.resolve(false);
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
