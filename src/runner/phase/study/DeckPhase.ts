import { StudyPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Deck選択画面)
 */
export default class DeckPhase extends StudyPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    this.logger.debug('Select deck.');
    await this.page.waitFor(1000);

    // デッキタブの選択
    const deckSel =
      'section[class="commonTab"] > ul >' + 'li[data-group="decks"]';
    const decks = await this.page.$$(deckSel);
    const deckCnt = this.runner.studyInfo.deck - 1;
    await decks[deckCnt].click();
    await this.page.waitFor(1000);

    // デッキエリアのボタンを探してクリック
    const areaSel = 'div[data-group="decks"]';
    const areas = await this.page.$$(areaSel);
    const button = await areas[deckCnt].$('.btnPrimary');
    if (button) {
      await button.click();
    }
  }
}
