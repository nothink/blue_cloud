import RunnerBase from './RunnerBase';

import { ElementHandle } from 'puppeteer';
import * as url from 'url';
import * as dateformat from 'dateformat';

import * as studyList from '../../studylist.json';

export class StudyRunner extends RunnerBase {
    studyTarget: string;
    rank: number;
    studyInfo = studyList['TOM'];
    usingSpark: boolean;
    usingSkill: boolean;
    dailySphere = 'SWEET';
    homeUrl: string;

    /**
     *  コンストラクタ
     */
    constructor(studyTarget: string) {
        super();

        // テスト勉強ホーム
        this.homeUrl = this.conf.testHomeUrl;

        this.studyTarget = studyTarget || 'level';
        if (['level', 'ring'].indexOf(this.studyTarget) === -1) {
            throw Error('Unknown Target: ' + this.studyTarget);
        }

        this.rank = this.conf.study.testRank || 1;

        this.usingSpark = this.conf.study.usingSpark;
        this.usingSkill = this.conf.study.usingSkill;
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
                            stageId=00&deckNum=0&partnerId=0000000_CLUB)
     *      (http://vcard.ameba.jp/study/battle?
                            stageId=00&deckNum=0&partnerId=0000000_FRIEND)
     *  result:リザルト画面、および中断ジャッジ
     *      (http://vcard.ameba.jp/s#study/battle/result)
     */
    get phase(): string {
        const current = url.parse(this.page.url());
        if (!current || !current.path) {
            // 初回、ないしは該当なしの場合は空ステータス
            return '';
        }
        if (current.path === '/study/battle') {
            // battleのみfragmentが存在しない特殊なフォーマット
            return 'battle';
        }
        if (!current.hash) {
            // battle以外はfragmentがない場合は空ステータス
            return '';
        }
        const fragms = current.hash.replace('#', '').split('/');
        // 基本的にfragmentの末尾で判定するためpop()
        let ftail = fragms.pop();
        if (ftail === 'select') {
            // 選択画面系は何の選択かで分類(fragmentの後ろから2番目)するので再度pop()
            ftail = fragms.pop();
        }
        return ftail;
    }

    /**
     *  今日の有利属性
     *  @returns    有利属性を表す文字列(Capital case: 'SWEET', 'COOL', 'POP')
     */
    get advantageSphere(): string {
        switch (this.dailySphere) {
        case 'SWEET':
            return 'POP';
        case 'COOL':
            return 'SWEET';
        case 'POP':
            return 'COOL';
        default:
            return null;
        }
    }

    /**
     *  ループ実行の一単位 (override)
     */
    async runOnce() {
        // Phaseで切り替える
        switch (this.phase) {
        case 'top':
            await this.startQuest();
            break;
        case 'quest':
            await this.selectQuest();
            break;
        case 'partner':
            await this.selectPartner();
            break;
        case 'deck':
            await this.selectDeck();
            break;
        case 'battle':
            await this.battle();
            break;
        case 'result':
            await this.checkResult();
            break;

        default:
            await this.page.waitFor(300);
            await this.goHome();
            this.logger.debug('[ Go quest home ]');
            break;
        }
    }

    /* -------------------------- status methods -------------------------- */
    /**
     *  クエスト（テスト勉強）の開始
     */
    async startQuest() {
        this.logger.debug('Start quest.');
        // 開始ボタンを押す
        const btnX = '/html/body/div[4]/div/div/div/div/div/section[2]/div/a';
        await this.page.waitForXPath(btnX);
        const button  = (await this.page.$x(btnX))[0];
        await button.click();
    }

    /**
     *  クエスト（テスト勉強）の選択
     */
    async selectQuest() {
        this.logger.debug('Select quest.');

        const pointSel = '.cell.vTop.textRight > div > span:nth-child(1)';
        await this.page.waitForSelector(pointSel);
        const point = await this.page.$eval(pointSel, (item: Element) => {
            return Number(item.textContent);
        });
        this.logger.debug(point + ' / 100');

        let tab: ElementHandle;
        let infoKey: string;
        const tabSel = '.js_btnTab.js_btnScenario';
        await this.page.waitForSelector(tabSel);
        const tabs = await this.page.$$(tabSel);
        if (this.studyTarget === 'level') {
            tab = tabs[0];
            infoKey = 'TOM';
        } else if (this.studyTarget === 'ring') {
            tab = tabs[1];
            await tab.click();

            const divSel = 'div.bgCream.pt5.ph5.pb10 > div:nth-child(2) > div';
            const sphere = await this.page.$$eval(divSel, (divs: Element[]) => {
                for (let i = 0; i < divs.length; i += 1) {
                    const attr = divs[i].getAttribute('class');
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
            });
            this.dailySphere = sphere;
            infoKey = sphere + this.rank.toString();
        }
        this.studyInfo = studyList[infoKey];
        this.logger.debug('next: ' + this.studyInfo['name']);

        // ダイアログが表示されていたら飛ばす
        const isContinue = await this.isDisplayedDialog();
        if (isContinue) {
            await this.page.waitForNavigation();
            return;
        }

        // 残りポイント不足の時は待機してテスト勉強トップに戻る
        if (!this.usingSpark && (point < this.studyInfo['cost'])) {
            await this.takeBreak(point);
            await this.goHome();
            return;
        }

        // 残りポイントをSTDOUTに出す
        process.stdout.write('\x033[2K\x033[G');
        process.stdout.write('\r[ ' + point + ' / 100 ]');
        process.stdout.write(' | cost: ' + this.studyInfo['cost']);

        // トグルが開いていない場合は開く
        const idx = 'list' + this.studyInfo['type'] + this.studyInfo['index'];
        const groupStr = '[data-group="' + idx + '"]';
        const closedSel = 'div.floatRight.sprite1_triangle' + groupStr;
        const openSel = 'div.floatRight.sprite1_triangle.rotate180' + groupStr;
        try {
            await this.page.waitForSelector(openSel, { timeout: 200 });
        } catch {
            await this.page.waitForSelector(closedSel, { timeout: 200 });
            await this.page.click(closedSel);
        }

        // クエストを選択（およびクリック）
        const buttonSel = '[data-state*="' + this.studyInfo['id'] + '"]';
        await this.page.waitForSelector(buttonSel);
        await this.page.waitFor(300);
        await this.page.click(buttonSel);
    }

    /**
     *  パートナーの選択
     */
    async selectPartner() {
        this.logger.debug('Select partner.');
        await this.page.waitForSelector('section.bgTiffanyBlue');

        const partnersSel = 'section.bgTiffanyBlue > '
            + 'div.relative.bgPartner.pt5 > '
            + 'div[data-href="#study/deck/select"]';

        const partners = await this.page.$$(partnersSel);
        if (this.studyTarget === 'level') {
            // 通常の時はランダムで選択
            const i = Math.floor(Math.random() * partners.length);
            await partners[i].click();
        } else if (this.studyTarget === 'ring') {
            // スペシャルの場合は属性で吟味する
            let top: ElementHandle;
            let topAtk = 0;
            let best: ElementHandle;
            let bestAtk = 0;
            // 最も攻援が高く、できれば得意属性のパートナーを検索
            for (let i = 0; i < partners.length; i += 1) {
                const info = await partners[i]
                             .$eval('div[data-group="detail"]',
                                    (detail: Element) => {
                                        return JSON.parse(
                                            detail.getAttribute('data-json'));
                                    });
                const infoPartner = info['partner'];
                if (topAtk < infoPartner['attack']) {
                    // 一番攻援が高いパートナーを保持
                    top = partners[i];
                    topAtk = infoPartner['attack'];
                }
                if (infoPartner['girlSphereName'] ===
                                this.advantageSphere.toLowerCase()) {
                    if (bestAtk < infoPartner['attack']) {
                        // 一番攻援が高いパートナーを保持
                        best = partners[i];
                        bestAtk = infoPartner['attack'];
                    }
                }
            }
            if (!best) {
                best = top;
            }
            await best.click();
        }
    }

    /**
     *  デッキの選択
     */
    async selectDeck() {
        this.logger.debug('Select deck.');

        // デッキタブの選択
        const deckSel = 'section[class="commonTab"] > ul > '
                        + 'li[data-group="decks"]';
        await this.page.waitForSelector(deckSel);
        const decks = await this.page.$$(deckSel);
        const deckCnt = this.studyInfo['deck'] - 1;
        await decks[deckCnt].click();

        // デッキエリアのボタンを探してクリック
        const areaSel = 'div[data-group="decks"]';
        const areas = await this.page.$$(areaSel);
        const button = await areas[deckCnt].$('.btnPrimary');
        await button.click();
    }

    /**
     *  テスト勉強実行
     */
    async battle() {
        this.logger.debug('battle.');

        // コンテニューの時は飛ばす
        this.passIfContinue();

        try {
            while (this.phase === 'battle') {
                const canvas = await this.page.waitForSelector('#canvas');
                await this.page.waitFor(3200); // 初期アニメーション
                await canvas.click();
                await this.page.waitFor(6300); // ローディングアニメーション（スーパーモヤモヤ含む）

                if (this.usingSkill) {
                    // TODO: self.useSkills();
                }
                // クリック後、ランダムな時間で休む
                this.clickOnce();
                await this.page.waitFor(2000);
                // sleep.sleep(3.14 + 2.718 * Math.random());
                // リロード
                this.redo();
            }
        } catch (e) {
            this.logger.error(e);
            this.redo();
        } finally {
            // 完了後リロード
            this.redo();
        }
    }

    /**
     *  結果画面の確認
     */
    async checkResult() {
        this.logger.debug('Check Result.');

        await this.page.waitFor(10000);
        throw Error('not implemented.');
    }

    /* ----------------------------- utilities ----------------------------- */
    /**
     *  しばし休む。
     *  回復量は60秒で1ポイントなので、最大100ポイントへの差分だけ待機。
     *  @param current 現在のポイント
     */
    async takeBreak(current) {
        const delta = 100 - current;
        const next = performance.now() + (delta * 60 * 1000);
        let left = next - performance.now();
        while (left > 0) {
            const leftStr = dateformat(left, 'H:MM:ss.l');
            process.stdout.write('\r - remain: ' + leftStr);
            await this.page.waitFor(50);
            left = next - performance.now();
        }
        process.stdout.write('\x033[2K\x033[G');
        process.stdout.write('Reboot...');

        while (true) {
            try {
                await this.goBase();
                break;
            } catch (e) {
                await this.page.waitFor(200);
                continue;
            }
        }
    }

    /**
     *  勉強中のボタンを一度クリックする(10秒制限)
     */
    async clickOnce() {
        const buttonSel = '.js_attackBtn.block:not([disabled])';
        await this.page.waitForSelector(buttonSel, { timeout: 10000 });
        const button = await this.page.$(buttonSel);
        button.click();
    }

    /**
     *  中断などのダイアログが表示されているかどうかをチェックして
     *  もし表示されていたらダイアログを飛ばす
     *  TODO : ちなみに各ダイアログはpopupWindowのクラスごとに種別がある
     *         集中P不足:「回復する」(popupWindow block js_popupUpdateAp)
     */
    async isDisplayedDialog(): Promise<boolean> {
        try {
            const popupSel = '.popupWindow';
            await this.page.waitForSelector(popupSel, { timeout: 300 });
            const popup = await this.page.$(popupSel);
            if (!popup) {
                return Promise.resolve(false);
            }
        } catch {
            // セレクタが存在しない時は正常
            return Promise.resolve(false);
        }

        const button = await this.page.$('.js_restart.btn');
        if (button) {
            await button.click();
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    /**
     *  コンテニュー画面が表示された場合、炭酸を消費して飛ばす
     */
    async passIfContinue() {
        const popSel = '.js_outPutPopupContinueMenu.homeMenu.z5.none.block';
        try {
            await this.page.waitForSelector(popSel, { timeout: 1000 });
            const popup = await this.page.$(popSel);

            // コンテニューボタン側をクリック
            const button = await popup.$('.js_continueBtn');
            if (button) {
                process.stdout.write('\n[Continue]');
                this.logger.debug('[Continue]');
                await button.click();
            }
        } catch {
            // セレクタが存在しないのが正常
            return;
        }
    }
}
