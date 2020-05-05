import Puppet from '@/common/Puppet';

import { StudyPhase } from '../../base/PhaseBase';

/**
 * テスト勉強用のランナーフェイズ(Top画面)
 */
export default class ResultPhase extends StudyPhase {
  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    // TODO: ここawaitせずにreturnしていい？
    // Promise<Response|null> なのでそのままでは返せない
    await Puppet.page.goto('https://vcard.ameba.jp/s#study/quest/select', {
      waitUntil: 'networkidle2',
    });
  }
}
