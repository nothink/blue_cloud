import { StudyPhase } from '../../base/PhaseBase';
import StudyInfo from '../../../units/StudyInfo';

/**
 * テスト勉強用のランナースクリプト
 */
export default class PartnerPhase extends StudyPhase {
  public studyInfo!: StudyInfo;

  /**
   *  単一処理の一単位
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    return;
  }

  /* ----------------------------- utilities ----------------------------- */
}
