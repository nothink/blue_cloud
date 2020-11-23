import Puppet from '@/common/Puppet';

import ChampionshipRunner from '../../ChampionshipRunner';
import { ChampionshipPhase } from '../../base/PhaseBase';
import Utils from './utils';

import fs from 'fs';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class BossBattlePhase extends ChampionshipPhase {
  // 期待される値
  private expected!: number;

  constructor(runner: ChampionshipRunner) {
    super(runner);

    // 一時保存した発揮値をリストア
    const tmpPath = `config/${process.env.NODE_ENV}.tmp`;
    try {
      fs.statSync(tmpPath);
      this.expected = parseInt(fs.readFileSync(tmpPath, 'utf-8'), 10);
    } catch (e) {
      this.expected = NaN;
    }
  }

  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return this.bossBattle();
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
      Utils.GetHearts(),
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
      this.runner.goHome();
      return;
    }
    if (isFullGauge && !hasBuff && isRare && hearts === 5) {
      // ゲージ満タン, バフ未発動, レア敵、ハート満タンの時はバフ着火ボタンを押す
      const fire = await Puppet.page.$('.js_fireStealth');
      if (fire) {
        const fireBox = await fire.boundingBox();
        if (fireBox) {
          await Puppet.page.mouse.click(fireBox.x + 1, fireBox.y + 1);
          await Puppet.page.waitForTimeout(400);
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

  // --------------------------- utils
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
}
