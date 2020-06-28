import config from '@/common/Config';
import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

import RunnerBase from './base/RunnerBase';

import QuestPhase from './phase/story/QuestPhase';
import DiscoveryAnimationPhase from './phase/story/DiscoveryAnimationPhase';
import EventPhase from './phase/story/EventPhase';
import EventAnimationPhase from './phase/story/EventAnimationPhase';
import LevelupAnimationPhase from './phase/story/LevelupAnimationPhase';
import PointAnimationPhase from './phase/story/PointAnimationPhase';
import TimeoutPhase from './phase/story/TimeoutPhase';

import url from 'url';
import EventResultPhase from './phase/story/EventResultPhase';

/**
 * ふむふむ（聖櫻学園物語）用のランナースクリプト
 */
export default class StoryRunner extends RunnerBase {
  protected homeUrl!: string;

  private eventId!: number; // TODO: Phase行き
  private questId!: number; // TODO: Phase行き
  public usingSpecial!: boolean; // TODO: Phase行き

  /**
   *  コンストラクタ
   */
  constructor() {
    super();

    this.eventId = config.get('story.eventId');
    this.questId = config.get('story.questId');
    this.usingSpecial = config.get('story.usingSpecial');

    // ふむふむホーム（ふむふむの基準ページは、イベントIDとクエストIDに依存する）
    this.homeUrl =
      `${config.get('storyHomeUrlBase')}` +
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
    const current = url.parse(Puppet.page.url());
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
      case 'quest': {
        const ph = new QuestPhase(this);
        return ph.proceed();
      }
      case 'discovery-animation': {
        const ph = new DiscoveryAnimationPhase(this);
        return ph.proceed();
      }
      case 'event': {
        const ph = new EventPhase(this);
        return ph.proceed();
      }
      case 'event-animation': {
        const ph = new EventAnimationPhase(this);
        return ph.proceed();
      }
      case 'levelup-animation': {
        const ph = new LevelupAnimationPhase(this);
        return ph.proceed();
      }
      case 'point-animation': {
        const ph = new PointAnimationPhase(this);
        return ph.proceed();
      }
      case 'event-result': {
        const ph = new EventResultPhase(this);
        return ph.proceed();
      }
      case 'timeout': {
        const ph = new TimeoutPhase(this);
        return ph.proceed();
      }
      case 'animation':
        // アニメーションが始まるのでリロードでキャンセル
        return this.goHome();

      default:
        await Puppet.page.waitFor(300);
        logger.warn(`unknown phase: "${this.phase}"`);
        return this.goHome();
    }
  }
}
