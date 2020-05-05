import logger from '@/common/logger';
import Puppet from '@/common/Puppet';

import { StudyPhase } from '../../base/PhaseBase';
import StudyInfo from '../../../units/StudyInfo';

import { ElementHandle } from 'puppeteer-core';

/**
 * テスト勉強用のランナーフェイズ(Partner選択画面)
 */
export default class PartnerPhase extends StudyPhase {
  public studyInfo!: StudyInfo;

  /**
   *  単一処理の一単位
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    logger.debug('Select partner.');
    await Puppet.page.waitFor(2000);

    const partnersSel =
      'section.bgTiffanyBlue > div.relative.bgPartner.pt5 > div[data-href="#study/deck/select"]';

    const partners = await Puppet.page.$$(partnersSel);
    if (this.runner.studyTarget === 'level') {
      // 通常の時はランダムで選択
      const i = Math.floor(Math.random() * partners.length);
      await partners[i].click();
    } else if (this.runner.studyTarget === 'ring') {
      // スペシャルの場合は属性で吟味する
      let top: ElementHandle = partners[0];
      let topAtk = 0;
      let best: ElementHandle = partners[0];
      let bestAtk = 0;
      // 最も攻援が高く、できれば得意属性のパートナーを検索
      for (const p of partners) {
        const info = await p.$eval(
          'div[data-group="detail"]',
          (detail: Element) => {
            const attr = detail.getAttribute('data-json') || '';
            return JSON.parse(attr);
          }
        );
        const infoPartner = info.partner;
        if (topAtk < infoPartner.attack) {
          // 一番攻援が高いパートナーを保持
          top = p;
          topAtk = infoPartner.attack;
        }
        if (
          infoPartner.girlSphereName ===
          this.runner.advantageSphere.toLowerCase()
        ) {
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
    return;
  }
}
