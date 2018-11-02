import RunnerBase from './RunnerBase';

import { ElementHandle } from 'puppeteer';
import * as url from 'url';
import * as sleep from 'sleep';

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
        if (!current || !current.path || !current.hash) {
            // 初回、ないしは該当なしの場合は空ステータス
            return '';
        }

        if (current.path === '/study/battle') {
            // battleのみfragmentが存在しない特殊なフォーマット
            return 'battle';
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
            this.logger.info('[ Go quest home ]');
            sleep.msleep(300);
            await this.goHome();
            break;
        }
//        console.log(this.studyTarget);
//        console.log(this.rank);
//        console.log(studyList['TOM']);
    }

    /* -------------------------- status methods -------------------------- */
    /**
     *  クエスト（テスト勉強）の開始
     */
    async startQuest() {
        this.logger.info('Start quest.');
        // 開始ボタンを押す
        const btnX = '/html/body/div[4]/div/div/div/div/div/section[2]/div/a';
        await this.clickByXpath(btnX);
    }

    /**
     *  クエスト（テスト勉強）の選択
     */
    async selectQuest() {
        this.logger.info('Select quest.');

        const pointSel = '.cell.vTop.textRight > div > span:nth-child(1)';
        await this.page.waitForSelector(pointSel);
        const point = await this.page.$eval(pointSel, (item: Element) => {
            return Number(item.textContent);
        });
        this.logger.info(point + '/100');

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
            infoKey = await this.page.$$eval(divSel, (divs: Element[]) => {
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
            infoKey += this.rank.toString();
        }
        this.studyInfo = studyList[infoKey];
        this.logger.info('next: ' + this.studyInfo['name']);

        // STDOUTに出す
        process.stdout.write('\x033[2K\x033[G');
        process.stdout.write('\r[ ' + point + ' / 100 ]');
        process.stdout.write(' | cost: ' + this.studyInfo['cost']);

        // 残りポイント不足の時は待機して抜ける
        if (!this.usingSpark && (point < this.studyInfo['cost'])) {
            this.takeBreak();
            this.redo();
            return;
        }

        sleep.msleep(100000);
        throw Error('not implemented.');
    }

    async selectPartner() {
        this.logger.info('Select partner.');
        sleep.msleep(10000);
        throw Error('not implemented.');
    }

    async selectDeck() {
        this.logger.info('Select deck.');
        sleep.msleep(10000);
        throw Error('not implemented.');
    }

    async battle() {
        this.logger.info('battle.');
        sleep.msleep(10000);
        throw Error('not implemented.');
    }

    async checkResult() {
        this.logger.info('Check Result.');
        sleep.msleep(10000);
        throw Error('not implemented.');
    }

    /* ----------------------------- utilities ----------------------------- */

    /**
     *  XPath指定でボタン等をクリック
     *  @param xpath XPath指定
     */
    async clickByXpath(xpath: string) {
        await this.page.waitForXPath(xpath);
        const button  = (await this.page.$x(xpath))[0];
        await button.click();
    }
}
