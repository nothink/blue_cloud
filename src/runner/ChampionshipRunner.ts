import config from '@/common/Config';
import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import RunnerBase from './base/RunnerBase';

import QuestPhase from './phase/champ/QuestPhase';
import EncountPhase from './phase/champ/EncountPhase';
import UserBattlePhase from './phase/champ/UserBattlePhase';
import BossBattlePhase from './phase/champ/BossBattlePhase';
import BattleAnimationPhase from './phase/champ/BattleAnimationPhase';
import ResultPhase from './phase/champ/ResultPhase';

import url from 'url';

/**
 *  カリスマ決定戦用のランナースクリプト
 */
export default class ChampionshipRunner extends RunnerBase {
  protected homeUrl!: string;

  // private usingCandy!: boolean;

  /**
   *  コンストラクタ
   */
  constructor() {
    super();

    // this.usingCandy = config.get("championship.usingCandy");

    // カリスマホーム
    this.homeUrl = config.get('championshipHomeUrl');
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
      case 'quest': {
        const ph = new QuestPhase(this);
        return ph.proceed();
      }
      case 'encount-animation': {
        const ph = new EncountPhase(this);
        return ph.proceed();
      }
      case 'user': {
        const ph = new UserBattlePhase(this);
        return ph.proceed();
      }
      case 'boss': {
        const ph = new BossBattlePhase(this);
        return ph.proceed();
      }
      case 'battle-animation': {
        const ph = new BattleAnimationPhase(this);
        return ph.proceed();
      }
      case 'result': {
        const ph = new ResultPhase(this);
        return ph.proceed();
      }
      default:
        await Puppet.page.waitForTimeout(300);
        logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
  }
}
