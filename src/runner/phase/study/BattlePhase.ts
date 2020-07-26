import logger from '@/common/logger';
import Puppet from '@/common/Puppet';

import { StudyPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(battle画面)
 */
export default class BattlePhase extends StudyPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    await Puppet.page.waitFor(600);

    // コンテニューの時は飛ばす
    await this.passIfContinue();

    try {
      while (this.runner.phase === 'battle') {
        const canvas = await Puppet.page.$('#canvas');
        if (!canvas) {
          // canvasなしはphase終了と同じ扱い
          // (タイミング的に)
          break;
        }
        await Puppet.page.waitFor(3100); // 初期アニメーション
        await canvas.click();
        await Puppet.page.waitFor(5300); // ローディングアニメーション

        if (this.runner.usingSkill) {
          // スキル必須の場合はスキル利用
          await this.useSkills();
        }

        // 攻撃クリック1回
        await Puppet.page.waitFor(2100); // 有効化待機
        await this.clickOnce();

        await Puppet.page.waitFor(600);
        await this.runner.redo();
        await Puppet.page.waitFor(600);
      }
    } catch (e) {
      logger.error(e);
      // 例外時はホームに戻る
      await this.runner.goHome();
    }
  }

  /* ----------------------------- utilities ----------------------------- */

  /**
   *  コンテニュー画面が表示された場合、集中炭酸を消費して飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passIfContinue(): Promise<void> {
    const popSel = '.js_outPutPopupContinueMenu.homeMenu.z5.none.block';
    try {
      // await Puppet.page.waitForSelector(popSel, { timeout: 2000 });
      const popup = await Puppet.page.$(popSel);
      // コンテニューボタン側をクリック
      if (popup) {
        const button = await popup.$('.js_continueBtn');
        if (button) {
          process.stdout.write('\n[Continue]');
          logger.debug('[Continue]');
          await button.click();
        }
      }
    } catch (e) {
      // セレクタが存在しないのが正常
      return;
    }
  }

  /**
   *  勉強中のボタンを一度クリックする
   *  @returns 空のpromiseオブジェクト
   */
  private async clickOnce(): Promise<void> {
    const canvas = await Puppet.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await Puppet.page.mouse.click(canvasBox.x + 220, canvasBox.y + 350);
      }
    }
  }

  /**
   *  必要に応じてスキルを順に判定して行使する
   *  @returns 空のpromiseオブジェクト
   */
  private async useSkills(): Promise<void> {
    const round = await Puppet.page.evaluate('INIT_JSON.enemy.roundNum');
    if ((round as number) < 5) {
      // 5ラウンドミッションの最終ラウンド以外は使う必要はない
      return;
    }

    let count = NaN;

    while (isNaN(count)) {
      try {
        await Puppet.page.waitFor(1900);
        count = await this.useSkillSomeone();
      } catch (e) {
        // スキルが無い場合はここに来るはず
        logger.warn(e.stack);
      }
      await this.runner.redo();
      const canvas = await Puppet.page.$('#canvas');
      if (canvas) {
        await Puppet.page.waitFor(3100); // 初期アニメーション
        await canvas.click();
        await Puppet.page.waitFor(5300); // ローディングアニメーション
      }
    }
  }

  /**
   *  スキルのグリッドを順番に走破して、ヒットした場合はスキルを発動する
   *  @returns 発動したスキル番号(0-9) / undefined: 発動可能スキルなし
   */
  private async useSkillSomeone(): Promise<number> {
    const canvas = await Puppet.page.$('#canvas');
    if (!canvas) {
      return Promise.resolve(NaN);
    }
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) {
      return Promise.resolve(NaN);
    }
    const cards = (await Puppet.page.evaluate(
      'window.MainCtl.module.iconArea.cards'
    )) as Array<{ activeSkill: { remainTurn: number; target: number } }>;
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const count = y * 3 + x;
        const skill = cards[count].activeSkill;
        if (!skill) {
          continue;
        }
        const remain = cards[count].activeSkill.remainTurn;
        const target = cards[count].activeSkill.target;
        if (remain === 0) {
          // 残り時間なしの場合
          // 座標をクリック
          await Puppet.page.mouse.click(
            canvasBox.x + 40 + 65 * x,
            canvasBox.y + 240 + 65 * y
          );
          await Puppet.page.waitFor(1900);
          // 発動ボタンをクリック
          await Puppet.page.mouse.click(canvasBox.x + 210, canvasBox.y + 370);
          await Puppet.page.waitFor(1900);
          if (target === 1) {
            // ターゲット単体のときはもう一度クリック
            await Puppet.page.mouse.click(canvasBox.x + 210, canvasBox.y + 370);
            await Puppet.page.waitFor(1900);
          }
          // 発動したスキルの番号を返す
          return Promise.resolve(count);
        }
      }
    }
    return Promise.resolve(NaN);
  }
}
