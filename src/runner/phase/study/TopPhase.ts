import { StudyPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class TopPhase extends StudyPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    // 基本的にTopPhaseと同じ

    // TODO: ここawaitせずにreturnしていい？
    // Promise<Response|null> なのでそのままでは返せない
    await this.page.goto('https://vcard.ameba.jp/s#study/quest/select', {
      waitUntil: 'networkidle2',
    });
  }
}
