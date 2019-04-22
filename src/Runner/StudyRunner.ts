import RunnerBase from './RunnerBase';

import { ElementHandle } from 'puppeteer';
import * as url from 'url';
import * as moment from 'moment';
import * as readline from 'readline';

import * as studyList from '../../studylist.json';

/**
 * テスト勉強用のランナースクリプト
 */
export class StudyRunner extends RunnerBase {
    studyTarget: string;
    rank: number;
    studyInfo!: any; // StudyInfo型
    usingSpark: boolean;
    usingSkill: boolean;
    dailySphere!: string;
    homeUrl: string;

    /**
     *  コンストラクタ
     */
    constructor(studyTarget: string) {
        super();

        // テスト勉強ホーム
        this.homeUrl = this.config.get('studyHomeUrl');

        this.studyTarget = studyTarget || 'level';
        if (['level', 'ring'].indexOf(this.studyTarget) === -1) {
            throw Error(`Unknown Target: ${this.studyTarget}`);
        }

        this.rank = this.config.get('study.testRank') || 1;

        this.usingSpark = this.config.get('study.usingSpark');
        this.usingSkill = this.config.get('study.usingSkill');
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
        if (!current || !current.pathname) {
            // 初回、ないしは該当なしの場合は空ステータス
            return '';
        }
        if (current.pathname === '/study/battle') {
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
     *  @returns 空のpromiseオブジェクト
     */
    async runOnce(): Promise<void> {
        // Phaseで切り替える
        switch (this.phase) {
        case '':
        case 'top':
            return this.startQuest();
        case 'quest':
            return this.selectQuest();
        case 'partner':
            return this.selectPartner();
        case 'deck':
            return this.selectDeck();
        case 'battle':
            return this.battle();
        case 'result':
            return this.checkResult();

        default:
            await this.page.waitFor(300);
            this.logger.warn(`unknown phase: "${this.phase}"`);
            return this.goHome();
        }
    }

    /* -------------------------- status methods -------------------------- */
    /**
     *  クエスト（テスト勉強）の開始
     * @returns 空のpromiseオブジェクト
     */
    async startQuest(): Promise<void> {
        await this.page.goto(
            'https://vcard.ameba.jp/s#study/quest/select',
            { waitUntil: 'networkidle2' },
        );
    }

    /**
     *  クエスト（テスト勉強）の選択
     * @returns 空のpromiseオブジェクト
     */
    async selectQuest(): Promise<void> {
        // 中断ダイアログが表示されていたら飛ばす
        const isContinue = await this.isDisplayedDialog();
        if (isContinue) {
            // コンティニュー直後は再判定
            return;
        }

        const conc = await this.getCurrentConcentration();

        await this.clickScenarioTab();

        // 残りポイント不足の時は待機してトップに戻る
        if (!this.usingSpark && (conc < this.studyInfo['cost'])) {
            await this.goBase();
            await this.page.waitFor(1000);
            await this.takeBreak(conc);
            return;
        }

        // 残りポイントをSTDOUTに出す
        // readline.clearLine(process.stdout, 0);
        // readline.cursorTo(process.stdout, 0);
        // process.stdout.write(`\r[ ${point} / 100 ]`);
        // process.stdout.write(` | cost: ${this.studyInfo['cost']}`);

        // トグルが開いていない場合は開く
        const idx = `list${this.studyInfo['type']}${this.studyInfo['index']}`;
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

        // クエストを選択（およびクリック）
        const buttonSel = `[data-state*="${this.studyInfo['id']}"]`;
        // await this.page.click(buttonSel);
        await this.page.$eval(buttonSel, (item: Element) => {
            const button = item as HTMLElement;
            button.click();
        });

        if (this.usingSpark) {
            this.logger.debug('using spark.');
            await this.useSpark();
        }
    }

    /**
     *  パートナーの選択
     * @returns 空のpromiseオブジェクト
     */
    async selectPartner(): Promise<void> {
        this.logger.debug('Select partner.');
        await this.page.waitFor(1000);

        const partnersSel = 'section.bgTiffanyBlue > \
        div.relative.bgPartner.pt5 > div[data-href="#study/deck/select"]';

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
     * @returns 空のpromiseオブジェクト
     */
    async selectDeck(): Promise<void> {
        this.logger.debug('Select deck.');
        await this.page.waitFor(1000);

        // デッキタブの選択
        const deckSel = 'section[class="commonTab"] > ul > '
                        + 'li[data-group="decks"]';
        const decks = await this.page.$$(deckSel);
        const deckCnt = this.studyInfo['deck'] - 1;
        await decks[deckCnt].click();
        await this.page.waitFor(1000);

        // デッキエリアのボタンを探してクリック
        const areaSel = 'div[data-group="decks"]';
        const areas = await this.page.$$(areaSel);
        const button = await areas[deckCnt].$('.btnPrimary');
        await button.click();
    }

    /**
     *  テスト勉強実行
     * @returns 空のpromiseオブジェクト
     */
    async battle(): Promise<void> {
        this.logger.debug('battle.');

        await this.page.waitFor(600);

        // コンテニューの時は飛ばす
        await this.passIfContinue();

        try {
            while (this.phase === 'battle') {
                const canvas = await this.page.$('#canvas');
                if (!canvas) {
                    // canvasなしはphase終了と同じ扱い
                    // (タイミング的に)
                    break;
                }
                await this.page.waitFor(3100); // 初期アニメーション
                await canvas.click();
                await this.page.waitFor(5300); // ローディングアニメーション

                if (this.usingSkill) {
                    // スキル必須の場合はスキル利用
                    await this.useSkills();
                }

                // 攻撃クリック1回
                await this.page.waitFor(2100); // 有効化待機
                await this.clickOnce();

                await this.page.waitFor(600);
                await this.redo();
                await this.page.waitFor(600);
            }
        } catch (e) {
            this.logger.error(e);
            // 例外時はホームに戻る
            await this.goHome();
        }
    }

    /**
     *  結果画面の確認
     * @returns 空のpromiseオブジェクト
     */
    async checkResult(): Promise<void> {
        this.logger.debug('Check Result.');
        await this.startQuest();
    }

    /* ----------------------------- utilities ----------------------------- */
    /**
     *  しばし休む。
     *  回復量は60秒で1ポイントなので、最大100ポイントへの差分だけ待機。
     *  @param current 現在のポイント
     *  @returns 空のpromiseオブジェクト
     */
    async takeBreak(current: number): Promise<void> {
        const delta = 100 - current;
        const next = moment().add(delta * 60, 'second');
        let left = next.diff(moment());
        while (left > 0) {
            const leftStr = moment(left).utc().format('H:mm:ss');
            const nextStr = next.format('MM/DD HH:mm:ss');
            process.stdout.write(`\r[next: ${nextStr}]: `
                + `${leftStr} remaining...`);
            await this.page.waitFor(200);
            left = next.diff(moment());
        }
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
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
     *  勉強中のボタンを一度クリックする
     *  @returns 空のpromiseオブジェクト
     */
    async clickOnce(): Promise<void> {
        const canvas = await this.page.$('#canvas');
        const canvasBox = await canvas.boundingBox();
        await this.page.mouse.click(
            canvasBox.x + 220,
            canvasBox.y + 350);
    }

    /**
     *  中断ダイアログが表示されているかどうかをチェックして
     *  もし表示されていたらダイアログを飛ばす
     *  @returns true: ダイアログが表示されている / false: ダイアログなし
     */
    async isDisplayedDialog(): Promise<boolean> {
        // 中断ダイアログの可否をチェック
        try {
            const dialogSel = '.js_popupReStartSelect';
            if (await this.page.$(dialogSel)) {
                const display = await this.page.$eval(
                    dialogSel,
                    (item: Element) => {
                        const cls = item.getAttribute('class');
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
        const resultSel = '.btn.btnPrimary[data-href="#study/battle/result"]';
        const resultButton = await this.page.$(resultSel);
        if (resultButton) {
            await resultButton.click();
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    /**
     *  集中炭酸の補充ダイアログが表示されているかどうかをチェックして
     *  もし表示されていたらダイアログを飛ばす
     * @returns 空のpromiseオブジェクト
     */
    async useSpark(): Promise<void> {
        try {
            const popupSel = '.js_output.absolute.block';
            const popup = await this.page.$(popupSel);
            if (!popup) {
                return;
            }
        } catch (e) {
            // セレクタが存在しない時は正常
            return;
        }

        const button = await this.page.$('.js_restart.btn');
        if (button) {
            await button.click();
            return;
        }
        const healSel = '.btn.btnPrimary.js_updateAp';
        const healButton = await this.page.$(healSel);
        if (healButton) {
            try {
                await healButton.click();
            } catch (e) {
                return;
            }
            return;
        }
        return;
    }

    /**
     *  コンテニュー画面が表示された場合、集中炭酸を消費して飛ばす
     *  @returns 空のpromiseオブジェクト
     */
    async passIfContinue(): Promise<void> {
        const popSel = '.js_outPutPopupContinueMenu.homeMenu.z5.none.block';
        try {
            // await this.page.waitForSelector(popSel, { timeout: 2000 });
            const popup = await this.page.$(popSel);
            // コンテニューボタン側をクリック
            const button = await popup.$('.js_continueBtn');
            if (button) {
                process.stdout.write('\n[Continue]');
                this.logger.debug('[Continue]');
                await button.click();
            }
        } catch (e) {
            // セレクタが存在しないのが正常
            return;
        }
    }

    /**
     *  必要に応じてスキルを順に判定して行使する
     *  @returns 空のpromiseオブジェクト
     */
    async useSkills(): Promise<void> {
        const round = await this.page.evaluate('INIT_JSON.enemy.roundNum');
        if (round < 5) {
            // 5ラウンドミッションの最終ラウンド以外は使う必要はない
            return;
        }

        let count: number = 0;

        while (count !== undefined) {
            try {
                await this.page.waitFor(1900);
                count = await this.useSkillSomeone();
            } catch (e) {
                // スキルが無い場合はここに来るはず
                this.logger.warn(e.stack);
            }
            await this.redo();
            const canvas = await this.page.$('#canvas');
            await this.page.waitFor(1600); // 初期アニメーション
            await canvas.click();
            await this.page.waitFor(4300); // ローディングアニメーション
        }
    }

    /**
     *  スキルのグリッドを順番に走破して、ヒットした場合はスキルを発動する
     *  @returns 発動したスキル番号(0-9) / undefined: 発動可能スキルなし
     */
    async useSkillSomeone(): Promise<number> {
        const canvas = await this.page.$('#canvas');
        const canvasBox = await canvas.boundingBox();
        const cards = await this.page.evaluate(
            'window.MainCtl.module.iconArea.cards');
        for (let y = 0; y < 3; y += 1) {
            for (let x = 0; x < 3; x += 1) {
                const count = y * 3 + x;
                const skill = cards[count]['activeSkill'];
                if (!skill) {
                    continue;
                }
                const remain = cards[count]['activeSkill']['remainTurn'];
                const target = cards[count]['activeSkill']['target'];
                if (remain === 0) {
                    // 残り時間なしの場合
                    // 座標をクリック
                    await this.page.mouse.click(
                        canvasBox.x + 40 + (65 * x),
                        canvasBox.y + 240 + (65 * y));
                    await this.page.waitFor(1900);
                    // 発動ボタンをクリック
                    await this.page.mouse.click(
                        canvasBox.x + 210,
                        canvasBox.y + 370);
                    await this.page.waitFor(1900);
                    if (target === 1) {
                        // ターゲット単体のときはもう一度クリック
                        await this.page.mouse.click(
                            canvasBox.x + 210,
                            canvasBox.y + 370);
                        await this.page.waitFor(1900);
                    }
                    // 発動したスキルの番号を返す
                    return Promise.resolve(count);
                }
            }
        }
        return Promise.resolve(undefined);
    }

    /**
     *  現在の集中ptを取得する
     *  @returns 集中pt(0-100) / NaN: 取得失敗
     */
    async getCurrentConcentration(): Promise<number> {
        const pointSel = 'div.cell.vTop.textRight > div > span:nth-child(1)';
        if (await this.page.$(pointSel)) {
            return this.page.$eval(
                pointSel,
                (item: Element) => {
                    return Number(item.textContent);
                });
        }
        return Promise.resolve(NaN);
    }

    /**
     *  シナリオタブを選択する
     *  @returns 空のpromiseオブジェクト
     */
    async clickScenarioTab(): Promise<void> {
        let infoKey: string;

        const tabSel = '.js_btnTab.js_btnScenario';
        const tabs = await this.page.$$(tabSel);
        if (this.studyTarget === 'level') {
            // tabs[0] が選択されているはず
            await tabs[0].click();
            infoKey = 'TOM';
        } else if (this.studyTarget === 'ring') {
            await tabs[1].click();
            await this.page.waitFor(300);

            const divSel = 'div.bgCream.pt5.ph5.pb10 > div:nth-child(2) > div';
            const sphere = await this.page.$$eval(
                divSel,
                (divs: Element[]) => {
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
    }
}
