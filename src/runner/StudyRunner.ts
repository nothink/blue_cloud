import config from '@/common/Config';
import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import RunnerBase from './base/RunnerBase';

import TopPhase from './phase/study/TopPhase';
import QuestPhase from './phase/study/QuestPhase';
import PartnerPhase from './phase/study/PartnerPhase';
import DeckPhase from './phase/study/DeckPhase';
import BattlePhase from './phase/study/BattlePhase';
import ResultPhase from './phase/study/ResultPhase';

import StudyInfo from '../units/StudyInfo';

import url from 'url';

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

  public usingSkill: boolean;
  public dailySphere!: 'SWEET' | 'COOL' | 'POP' | '';

  /**
   *  コンストラクタ
   */
  constructor(studyTarget: string) {
    super();

    // テスト勉強ホーム
    this.homeUrl = config.get('studyHomeUrl');

    this.studyTarget = studyTarget || 'level';
    if (['level', 'ring'].indexOf(this.studyTarget) === -1) {
      throw Error(`Unknown Target: ${this.studyTarget}`);
    }

    this.rank = config.get('study.testRank') || 1;

    this.usingSpark = config.get('study.usingSpark');
    this.usingSkill = config.get('study.usingSkill');
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
    const current = url.parse(Puppet.page.url());
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
      }
      case 'quest': {
        const ph = new QuestPhase(this);
        return ph.proceed();
      }
      case 'partner': {
        const ph = new PartnerPhase(this);
        return ph.proceed();
      }
      case 'deck': {
        const ph = new DeckPhase(this);
        return ph.proceed();
      }
      case 'battle': {
        const ph = new BattlePhase(this);
        return ph.proceed();
      }
      case 'result': {
        const ph = new ResultPhase(this);
        return ph.proceed();
      }

      default:
        await Puppet.page.waitFor(300);
        logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
  }
}
