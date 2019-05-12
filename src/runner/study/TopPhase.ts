import PhaseBase from '../base/PhaseBase';

/**
 * テスト勉強用のランナースクリプト
 */
export default class TopPhase extends PhaseBase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    await this.page.goto('https://vcard.ameba.jp/s#study/quest/select', {
      waitUntil: 'networkidle2',
    });
  }
}
