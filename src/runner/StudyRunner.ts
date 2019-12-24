import RunnerBase from './base/RunnerBase';

import QuestPhase from './study/QuestPhase';
import TopPhase from './study/TopPhase';

import StudyInfo from '../units/StudyInfo';

import { ElementHandle } from 'puppeteer';
import * as url from 'url';

/**
 * テスト勉強用のランナースクリプト
 */
export default class StudyRunner extends RunnerBase {
  public usingSpark: boolean; // Phase行き
  public studyTarget!: string; // Phase行き
  public rank!: number; // Phase行き
  public studyInfo!: StudyInfo;
  public deckNum!: number;

  protected homeUrl: string;

  private usingSkill: boolean;
  private dailySphere!: 'SWEET' | 'COOL' | 'POP' | '';

  /**
   *  コンストラクタ
   */
  constructor(studyTarget: string) {
    super();

    // テスト勉強ホーム
    this.homeUrl = this.config.get('studyHomeUrl');

    this.studyTarget = studyTarget || 'level';
    if (['level', 'ring'].indexOf(this.studyTarget) === -1) {
      throw Error(`Unknown Target: ${this.studyTarget}`);
    }

    this.rank = this.config.get('study.testRank') || 1;

    this.usingSpark = this.config.get('study.usingSpark');
    this.usingSkill = this.config.get('study.usingSkill');
  }

  /**
   *  現在の状態
   *  @returns    状態を表す文字列
   *  top:トップ画面(不使用)
   *      (http://vcard.ameba.jp/s#study/top)
   *  quest:クエスト選択画面、および中断ジャッジ、ポイントジャッジ
   *      (http://vcard.ameba.jp/s#study/quest/select)
   *  partner:助っ人選択画面
   *      (http://vcard.ameba.jp/s#study/partner/select)
   *  deck:デッキ選択画面
   *      (http://vcard.ameba.jp/s#study/deck/select)
   *  battle:バトル画面
   *      (http://vcard.ameba.jp/study/battle?
   *        stageId=00&deckNum=0&partnerId=0000000_CLUB)
   *      (http://vcard.ameba.jp/study/battle?
   *        stageId=00&deckNum=0&partnerId=0000000_FRIEND)
   *  result:リザルト画面、および中断ジャッジ
   *      (http://vcard.ameba.jp/s#study/battle/result)
   */
  get phase(): string {
    const current = url.parse(this.page.url());
    if (!current || !current.pathname) {
      // 初回、ないしは該当なしの場合は空ステータス
      return '';
    }
    if (current.pathname === '/study/battle') {
      // battleのみfragmentが存在しない特殊なフォーマット
      return 'battle';
    }
    if (!current.hash) {
      // battle以外はfragmentがない場合は空ステータス
      return '';
    }
    const fragms = current.hash.replace('#', '').split('/');
    // 基本的にfragmentの末尾で判定するためpop()
    let ftail = fragms.pop() || '';
    if (ftail === 'select') {
      // 選択画面系は何の選択かで分類(fragmentの後ろから2番目)するので再度pop()
      ftail = fragms.pop() || '';
    }
    return ftail;
  }

  /**
   *  今日の有利属性
   *  @returns    有利属性を表す文字列(Capital case: "SWEET", "COOL", "POP")
   */
  get advantageSphere(): 'SWEET' | 'COOL' | 'POP' | '' {
    switch (this.dailySphere) {
      case 'SWEET':
        return 'POP';
      case 'COOL':
        return 'SWEET';
      case 'POP':
        return 'COOL';
      default:
        return '';
    }
  }

  /**
   *  ループ実行の一単位 (override)
   *  @returns 空のpromiseオブジェクト
   */
  protected async runOnce(): Promise<void> {
    // Phaseで切り替える
    switch (this.phase) {
      case '':
      case 'top': {
        const ph = new TopPhase(this);
        return ph.proceed();
        // return this.startQuest();
      }
      case 'quest': {
        const pha = new QuestPhase(this);
        return pha.proceed();
        // return this.selectQuest();
      }
      case 'partner':
        return this.selectPartner();
      case 'deck':
        return this.selectDeck();
      case 'battle':
        return this.battle();
      case 'result':
        return this.checkResult();

      default:
        await this.page.waitFor(300);
        this.logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
  }

  /* -------------------------- status methods -------------------------- */
  /**
   *  クエスト（テスト勉強）の開始
   * @returns 空のpromiseオブジェクト
   */
  private async startQuest(): Promise<void> {
    await this.page.goto('https://vcard.ameba.jp/s#study/quest/select', {
      waitUntil: 'networkidle2',
    });
  }

  /**
   *  パートナーの選択
   * @returns 空のpromiseオブジェクト
   */
  private async selectPartner(): Promise<void> {
    this.logger.debug('Select partner.');
    await this.page.waitFor(2000);

    const partnersSel =
      "section.bgTiffanyBlue > \
        div.relative.bgPartner.pt5 > div[data-href='#study/deck/select']";

    const partners = await this.page.$$(partnersSel);
    if (this.studyTarget === 'level') {
      // 通常の時はランダムで選択
      const i = Math.floor(Math.random() * partners.length);
      await partners[i].click();
    } else if (this.studyTarget === 'ring') {
      // スペシャルの場合は属性で吟味する
      let top: ElementHandle = partners[0];
      let topAtk = 0;
      let best: ElementHandle = partners[0];
      let bestAtk = 0;
      // 最も攻援が高く、できれば得意属性のパートナーを検索
      for (const p of partners) {
        const info = await p.$eval(
          "div[data-group='detail']",
          (detail: Element) => {
            const attr = detail.getAttribute('data-json') || '';
            return JSON.parse(attr);
          },
        );
        const infoPartner = info.partner;
        if (topAtk < infoPartner.attack) {
          // 一番攻援が高いパートナーを保持
          top = p;
          topAtk = infoPartner.attack;
        }
        if (infoPartner.girlSphereName === this.advantageSphere.toLowerCase()) {
          if (bestAtk < infoPartner.attack) {
            // 一番攻援が高いパートナーを保持
            best = p;
            bestAtk = infoPartner.attack;
          }
        }
      }
      if (!best) {
        best = top;
      }
      await best.click();
    }
  }

  /**
   *  デッキの選択
   * @returns 空のpromiseオブジェクト
   */
  private async selectDeck(): Promise<void> {
    this.logger.debug('Select deck.');
    await this.page.waitFor(1000);

    // デッキタブの選択
    const deckSel =
      "section[class='commonTab'] > ul > " + "li[data-group='decks']";
    const decks = await this.page.$$(deckSel);
    const deckCnt = this.studyInfo.deck - 1;
    await decks[deckCnt].click();
    await this.page.waitFor(1000);

    // デッキエリアのボタンを探してクリック
    const areaSel = "div[data-group='decks']";
    const areas = await this.page.$$(areaSel);
    const button = await areas[deckCnt].$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }

  /**
   *  テスト勉強実行
   * @returns 空のpromiseオブジェクト
   */
  private async battle(): Promise<void> {
    this.logger.debug('battle.');

    await this.page.waitFor(600);

    // コンテニューの時は飛ばす
    await this.passIfContinue();

    try {
      while (this.phase === 'battle') {
        const canvas = await this.page.$('#canvas');
        if (!canvas) {
          // canvasなしはphase終了と同じ扱い
          // (タイミング的に)
          break;
        }
        await this.page.waitFor(3100); // 初期アニメーション
        await canvas.click();
        await this.page.waitFor(5300); // ローディングアニメーション

        if (this.usingSkill) {
          // スキル必須の場合はスキル利用
          await this.useSkills();
        }

        // 攻撃クリック1回
        await this.page.waitFor(2100); // 有効化待機
        await this.clickOnce();

        await this.page.waitFor(600);
        await this.redo();
        await this.page.waitFor(600);
      }
    } catch (e) {
      this.logger.error(e);
      // 例外時はホームに戻る
      await this.goHome();
    }
  }

  /**
   *  結果画面の確認
   * @returns 空のpromiseオブジェクト
   */
  private async checkResult(): Promise<void> {
    this.logger.debug('Check Result.');
    await this.startQuest();
  }

  /* ----------------------------- utilities ----------------------------- */

  /**
   *  勉強中のボタンを一度クリックする
   *  @returns 空のpromiseオブジェクト
   */
  private async clickOnce(): Promise<void> {
    const canvas = await this.page.$('#canvas');
    if (canvas) {
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await this.page.mouse.click(canvasBox.x + 220, canvasBox.y + 350);
      }
    }
  }

  /**
   *  コンテニュー画面が表示された場合、集中炭酸を消費して飛ばす
   *  @returns 空のpromiseオブジェクト
   */
  private async passIfContinue(): Promise<void> {
    const popSel = '.js_outPutPopupContinueMenu.homeMenu.z5.none.block';
    try {
      // await this.page.waitForSelector(popSel, { timeout: 2000 });
      const popup = await this.page.$(popSel);
      // コンテニューボタン側をクリック
      if (popup) {
        const button = await popup.$('.js_continueBtn');
        if (button) {
          process.stdout.write('\n[Continue]');
          this.logger.debug('[Continue]');
          await button.click();
        }
      }
    } catch (e) {
      // セレクタが存在しないのが正常
      return;
    }
  }

  /**
   *  必要に応じてスキルを順に判定して行使する
   *  @returns 空のpromiseオブジェクト
   */
  private async useSkills(): Promise<void> {
    const round = await this.page.evaluate('INIT_JSON.enemy.roundNum');
    if ((round as number) < 5) {
      // 5ラウンドミッションの最終ラウンド以外は使う必要はない
      return;
    }

    let count = 0;

    while (isNaN(count)) {
      try {
        await this.page.waitFor(1900);
        count = await this.useSkillSomeone();
      } catch (e) {
        // スキルが無い場合はここに来るはず
        this.logger.warn(e.stack);
      }
      await this.redo();
      const canvas = await this.page.$('#canvas');
      if (canvas) {
        await this.page.waitFor(3100); // 初期アニメーション
        await canvas.click();
        await this.page.waitFor(5300); // ローディングアニメーション
      }
    }
  }

  /**
   *  スキルのグリッドを順番に走破して、ヒットした場合はスキルを発動する
   *  @returns 発動したスキル番号(0-9) / undefined: 発動可能スキルなし
   */
  private async useSkillSomeone(): Promise<number> {
    const canvas = await this.page.$('#canvas');
    if (!canvas) {
      return Promise.resolve(NaN);
    }
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) {
      return Promise.resolve(NaN);
    }
    const cards = await this.page.evaluate(
      'window.MainCtl.module.iconArea.cards',
    );
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const count = y * 3 + x;
        const skill = (cards as any)[count].activeSkill;
        if (!skill) {
          continue;
        }
        const remain = (cards as any)[count].activeSkill.remainTurn;
        const target = (cards as any)[count].activeSkill.target;
        if (remain === 0) {
          // 残り時間なしの場合
          // 座標をクリック
          await this.page.mouse.click(
            canvasBox.x + 40 + 65 * x,
            canvasBox.y + 240 + 65 * y,
          );
          await this.page.waitFor(1900);
          // 発動ボタンをクリック
          await this.page.mouse.click(canvasBox.x + 210, canvasBox.y + 370);
          await this.page.waitFor(1900);
          if (target === 1) {
            // ターゲット単体のときはもう一度クリック
            await this.page.mouse.click(canvasBox.x + 210, canvasBox.y + 370);
            await this.page.waitFor(1900);
          }
          // 発動したスキルの番号を返す
          return Promise.resolve(count);
        }
      }
    }
    return Promise.resolve(NaN);
  }
}
