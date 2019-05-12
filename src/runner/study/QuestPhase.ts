import { StudyPhase } from '../base/PhaseBase';

import StudyRunner from '../StudyRunner';

import * as moment from 'moment';

import * as Studies from '../../../json/studies.json';

/**
 * テスト勉強用のランナースクリプト
 */
export default class QuestPhase extends StudyPhase {
  public dailySphere: 'SWEET' | 'COOL' | 'POP' | '' = '';

  public studyInfo!: any; // StudyInfo型

  /**
   *  単一処理の一単位
   *  @returns 空のpromiseオブジェクト
   */
  public async proceed(): Promise<void> {
    // 中断ダイアログが表示されていたら飛ばす
    const isContinue = await this.isDisplayedDialog();
    if (isContinue) {
      // コンティニュー直後は再判定
      return;
    }

    // 現在の集中ptを取得
    const conc = await this.getCurrentConcentration();

    // シナリオタブを選択
    await this.clickScenarioTab();

    // 炭酸不許可で集中pt不足の時は待機してトップに戻る
    if (!this.runner.usingSpark && conc < this.studyInfo.cost) {
      await this.runner.goBaseHome();
      await this.page.waitFor(1000);
      await this.takeBreak(conc);
      return;
    }

    // トグルが開いていない場合は開く
    await this.openToggle();

    // クエストを選択（およびクリック）
    const buttonSel = `[data-state*="${this.studyInfo.id}"]`;
    // await this.page.click(buttonSel);
    await this.page.$eval(buttonSel, (item: Element) => {
      const button = item as HTMLElement;
      button.click();
    });

    // 集中pt不足の時は集中炭酸を使う
    if (this.runner.usingSpark) {
      this.runner.logger.debug('using spark.');
      await this.useSpark();
    }
  }

  /* ----------------------------- utilities ----------------------------- */

  /**
   *  中断ダイアログが表示されているかどうかをチェックして
   *  もし表示されていたらダイアログを飛ばす
   *  @returns true: ダイアログが表示されている / false: ダイアログなし
   */
  private async isDisplayedDialog(): Promise<boolean> {
    // 中断ダイアログの可否をチェック
    try {
      const dialogSel = '.js_popupReStartSelect';
      if (await this.page.$(dialogSel)) {
        const display = await this.page.$eval(dialogSel, (item: Element) => {
          const cls = item.getAttribute('class') || '';
          if (cls.includes('block')) {
            return true;
          }
          return false;
        });
        if (!display) {
          // ダイアログ非表示
          return Promise.resolve(false);
        }
      }
    } catch (e) {
      // ダイアログ要素そのものが無い場合はページ違い
      return Promise.resolve(false);
    }

    // 再開ボタンが存在する時
    const button = await this.page.$('.js_restart.btn');
    if (button) {
      await button.click();
      return Promise.resolve(true);
    }
    // 結果ボタンが存在するとき
    const resultSel = ".btn.btnPrimary[data-href='#study/battle/result']";
    const resultButton = await this.page.$(resultSel);
    if (resultButton) {
      await resultButton.click();
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  /**
   *  現在の集中ptを取得する
   *  @returns 集中pt(0-100)のPromise / NaN: 取得失敗
   */
  private async getCurrentConcentration(): Promise<number> {
    const pointSel = 'div.cell.vTop.textRight > div > span:nth-child(1)';
    if (await this.page.$(pointSel)) {
      return this.page.$eval(pointSel, (item: Element) => {
        return Number(item.textContent);
      });
    }
    return Promise.resolve(NaN);
  }

  /**
   *  シナリオタブを選択する
   *  @returns 空のpromiseオブジェクト
   */
  private async clickScenarioTab(): Promise<void> {
    let infoKey: string;

    const tabSel = '.js_btnTab.js_btnScenario';
    const tabs = await this.page.$$(tabSel);
    if ((this.runner as StudyRunner).studyTarget === 'level') {
      // tabs[0] が選択されているはず
      await tabs[0].click();
      this.dailySphere = '';
      infoKey = 'TOM';
    } else if ((this.runner as StudyRunner).studyTarget === 'ring') {
      await tabs[1].click();
      await this.page.waitFor(300);

      const divSel = 'div.bgCream.pt5.ph5.pb10 > div:nth-child(2) > div';
      const sphere = await this.page.$$eval(divSel, (divs: Element[]) => {
        for (const d of divs) {
          const attr = d.getAttribute('class') || '';
          if (attr.includes('Sweet')) {
            return 'SWEET';
          }
          if (attr.includes('Cool')) {
            return 'COOL';
          }
          if (attr.includes('Pop')) {
            return 'POP';
          }
        }
        return '';
      });
      this.dailySphere = sphere;
      infoKey = sphere + (this.runner as StudyRunner).rank.toString();
    } else {
      this.dailySphere = '';
      infoKey = '';
    }
    this.studyInfo = Studies[infoKey];
    (this.runner as StudyRunner).studyInfo = Studies[infoKey];
  }

  /**
   *  しばし休む。
   *  回復量は60秒で1ポイントなので、最大100ポイントへの差分だけ待機。
   *  @param current 現在のポイント
   *  @returns 空のpromiseオブジェクト
   */
  private async takeBreak(current: number): Promise<void> {
    const delta = 100 - current;
    const next = moment().add(delta * 60, 'second');
    let left = next.diff(moment());
    while (left > 0) {
      const leftStr = moment(left)
        .utc()
        .format('H:mm:ss');
      const nextStr = next.format('MM/DD HH:mm:ss');
      process.stdout.write(
        `\r[next: ${nextStr}]: ` + `${leftStr} remaining...`,
      );
      await this.page.waitFor(200);
      left = next.diff(moment());
    }
    this.logger.info('Reboot...');

    while (true) {
      try {
        await this.runner.goBaseHome();
        break;
      } catch (e) {
        await this.page.waitFor(200);
        continue;
      }
    }
  }

  /**
   *  集中炭酸の補充ダイアログが表示されているかどうかをチェックして
   *  もし表示されていたらダイアログを飛ばす
   * @returns 空のpromiseオブジェクト
   */
  private async useSpark(): Promise<void> {
    try {
      const popupSel = '.js_output.absolute.block';
      const popup = await this.page.$(popupSel);
      if (!popup) {
        // ダイアログが存在しない時は通常時
        return;
      }
    } catch (e) {
      // セレクタが存在しない時は通常時
      return;
    }

    // 補充ボタンではなく再開ボタンが有る場合は戻る
    const button = await this.page.$('.js_restart.btn');
    if (button) {
      await button.click();
      return;
    }

    // 補充ボタン押下
    const healSel = '.btn.btnPrimary.js_updateAp';
    const healButton = await this.page.$(healSel);
    if (healButton) {
      try {
        await healButton.click();
      } catch (e) {
        return;
      }
    }
  }

  /**
   *  勉強選択前のトグルをチェックして、閉じていたら開く
   * @returns 空のpromiseオブジェクト
   */
  private async openToggle(): Promise<void> {
    const idx = `list${this.studyInfo.type}${this.studyInfo.index}`;
    const groupStr = `[data-group="${idx}"]`;
    const closedSel = `div.floatRight.sprite1_triangle${groupStr}`;
    const openSel = `div.floatRight.sprite1_triangle.rotate180${groupStr}`;
    try {
      if (await this.page.$(openSel)) {
        // 対象セレクタは開いている
      } else {
        throw new EvalError('closed.');
      }
    } catch (e) {
      // 対象セレクタは閉じているので開く
      // this.page.click(closedSel);
      this.page.$eval(closedSel, (item: Element) => {
        const button = item as HTMLElement;
        button.click();
      });
      await this.page.waitFor(1000);
    }
  }
}
