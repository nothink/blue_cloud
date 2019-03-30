import RunnerBase from './RunnerBase';

import * as fs from 'fs';
import { ElementHandle } from 'puppeteer';
import * as url from 'url';

/**
 *  カリスマ決定戦用のランナースクリプト
 */
export class ChampionshipRunner extends RunnerBase {
    homeUrl: string;
    usingCandy: boolean;
    expected: number;

    /**
     *  コンストラクタ
     */
    constructor() {
        super();

        this.usingCandy = this.config.get('championship.usingCandy');
        // カリスマホーム
        this.homeUrl = this.config.get('championshipHomeUrl');

        const tmpPath = `config/${process.env.NODE_ENV}.tmp`;
        try {
            fs.statSync(tmpPath);
            this.expected = parseInt(fs.readFileSync(tmpPath, 'utf-8'), 10);
        } catch (e) {
            this.expected = undefined;
        }
        console.log(this.expected);
    }

    /**
     *  現在の状態
     *  @returns    状態を表す文字列
     *      quest (https://vcard.ameba.jp/championship/quest/detail): クエストエリア
     *      encount-animation
     *          (https://vcard.ameba.jp/championship/battle/user/encount-animation?battleId=5471695_1_1553701704104)
     *          (https://vcard.ameba.jp/championship/battle/boss/encount-animation?battleId=5471695_1_1553699746854)
     *              : エンカウントアニメーション
     *      user (https://vcard.ameba.jp/championship/battle/user/detail?battleId=5471695_1_1553696455817): ユーザアピール
     *      boss (https://vcard.ameba.jp/championship/battle/boss/detail?battleId=5471695_1_1553699746854): ボスアピール
     *      battle-animation
     *          (https://vcard.ameba.jp/championship/battle/user/battle-animation?useItemFlg=false&useSmallItemFlg=false&useAp=1&battleId=5471695_1_1553699227783&token=u8UUNc)
     *          (https://vcard.ameba.jp/championship/battle/boss/battle-animation?useItemFlg=false&useSmallItemFlg=false&useAp=1&battleId=5471695_1_1553704442335&token=Vuoj63&clubSupport=false)
     *              : バトルアニメーション
     *      result
     *          (https://vcard.ameba.jp/championship/battle/user/result?battleId=5471695_1_1553699227783)
     *          (https://vcard.ameba.jp/championship/battle/boss/result?battleId=5471695_1_1553704442335)
     *              : バトル結果画面
     */
    get phase(): string {
        const current = url.parse(this.page.url());
        if (!current || !current.pathname || current.pathname === '/') {
            // 初回、ないしは該当なしの場合は空ステータス
            return '';
        }
        const fragms = current.pathname.split('/');
        // 基本的にfragmentの末尾で判定するためpop()
        const ftail = fragms.pop();
        if (ftail === 'detail') {
            if (fragms[2] === 'battle') {
                return fragms[3];
            }
            return fragms[2];
        }
        return ftail;
    }

    /**
     *  ループ実行の一単位 (override)
     *  @returns 空のpromiseオブジェクト
     */
    async runOnce(): Promise<void> {
        // Phaseで切り替える
        // console.log(this.phase);
        switch (this.phase) {
        case 'quest':
            await this.walk();
            break;
        case 'encount-animation':
            await this.skipEncount();
            break;
        case 'user':
            await this.userBattle();
            break;
        case 'boss':
            await this.bossBattle();
            break;
        case 'battle-animation':
            await this.skipAnimation();
            break;
        case 'result':
            await this.skipResult();
            break;
        default:
            await this.goHome();
            this.logger.debug('[ Go championship home ]');
            break;
        }
    }

    /**
     *  カリスマのエリア歩行
     *  @returns 空のpromiseオブジェクト
     */
    async walk(): Promise<void> {
        // ダイアログが表示されている場合飛ばす
        await this.passDialog();

        // ゲージ満タンかのチェック
        if (this.isFullGauge()) {
            console.log('Gauge is full.');
        }

        const life = await this.getHearts();

        // アピールタイムかどうかのチェック
        const appealIcon = await this.page.$('.js_appealTime');
        let scene: string = '';
        if (appealIcon) {
            scene = await this.page.$eval('.js_appealTime', (item: Element) => {
                const href = (<HTMLAnchorElement>item).href;
                if (href.includes('boss')) {
                    return 'boss';
                }
                if (href.includes('user')) {
                    return 'user';
                }
            });
        }

        if (scene === 'user' && life > 1) {
            const iconBox = await appealIcon.boundingBox();
            const mouse = await this.page.mouse;
            await mouse.click(iconBox.x + 7, iconBox.y + 7);
            return;
        }
        if (scene === 'boss' && life === 5) {
            const iconBox = await appealIcon.boundingBox();
            const mouse = await this.page.mouse;
            await mouse.click(iconBox.x + 7, iconBox.y + 7);
            return;
        }

        const button = await this.page.$('#js_btnFight');
        if (button) {
            const buttonBox = await button.boundingBox();
            const mouse = await this.page.mouse;
            await mouse.click(buttonBox.x + 12, buttonBox.y + 12);
        }
    }

    /**
     *  対ユーザバトル処理
     *  @returns 空のpromiseオブジェクト
     */
    async userBattle(): Promise<void> {
        const mySel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatLeft.half > p:nth-child(2)';
        const tgtSel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatRight.half.textRight > p:nth-child(2)';
        const myAttack = await this.page.$eval(mySel, (item: Element) => {
            return Number(item.textContent);
        });
        const tgtAttack = await this.page.$eval(tgtSel, (item: Element) => {
            return Number(item.textContent);
        });
        const life = await this.getHearts();
        // ライフ消費は、自分の攻が相手の1.2倍だったら1つ、それ以外は2とする
        const needLife = (myAttack > tgtAttack * 1.2) ? 1 : 2;
        if (life < needLife) {
            this.goHome();
            return;
        }
        const buttonDivs = await this.page.$$('.js_heartSelectionBtn');
        const button = await buttonDivs[needLife - 1];
        const buttonBox = await button.boundingBox();
        const mouse = await this.page.mouse;
        await mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }

    /**
     *  ボスバトル（アピールタイム）処理
     *  @returns 空のpromiseオブジェクト
     */
    async bossBattle(): Promise<void> {
        const isRare = await this.isRare();
        if (isRare) {
            console.log('rare');
        }

        const curSel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section.ofHidden > div > div.dropShadow.relative.z1 > div.textCenter.relative.fs12 > span.fcPink.outlineWhite';
        const maxSel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section.ofHidden > div > div.dropShadow.relative.z1 > div.textCenter.relative.fs12 > span:nth-child(2)';
        const current = await this.page.$eval(curSel, (item: Element) => {
            return Number(item.textContent.replace(/,/g, ''));
        });
        const max = await this.page.$eval(maxSel, (item: Element) => {
            return Number(item.textContent.substring(1).replace(/,/g, ''));
        });

        let needLife = 0;
        if (!this.expected && current === 0) {
            needLife = 1;
        } else {
            if (!this.expected) {
                this.expected = current;
                const tmpPath = `config/${process.env.NODE_ENV}.tmp`;
                fs.writeFileSync(tmpPath, String(this.expected));
            }
            const remain =  max - current;
            if (remain < this.expected * 0.9) {
                needLife = 1;
            } else if (remain < this.expected * 2.0) {
                needLife = 2;
            } else if (remain < this.expected * 3.1) {
                needLife = 3;
            } else if (remain < this.expected * 4.3) {
                needLife = 4;
            } else {
                needLife = 5;
            }
        }
        const buttonDivs = await this.page.$$('.js_heartSelectionBtn');
        const hearts = await this.getHearts();
        if (hearts < needLife) {
            this.goHome();
            return;
        }
        const button = await buttonDivs[needLife - 1];
        const buttonBox = await button.boundingBox();
        const mouse = await this.page.mouse;
        await mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }

    /**
     *  戦闘アニメーションをリロードしてスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async skipAnimation(): Promise<void> {
        await this.redo();
    }

    /**
     *  戦闘結果画面をスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async skipResult(): Promise<void> {
        const selector = '.btnPrimary.jsTouchActive';
        const button = await this.page.$(selector);
        if (button) {
            await button.click();
        }
    }

    /**
     *  遭遇画面（ユーザ、アピール）をスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async skipEncount(): Promise<void> {
        const canvas = await this.page.waitForSelector('#canvas');
        await canvas.click();
        await this.page.waitFor(300); // アニメーション
        await canvas.click();
    }

    // internal -----------------------------------------

    /**
     *  バー補給ダイアログの有無をチェックし、表示されている場合はバーを利用してスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async passDialog(): Promise<void> {
        const popupSel = '#outStamina[style*="block"]';
        try {
            await this.page.waitForSelector(popupSel, { timeout: 300 });
        } catch (e) {
            // セレクタが存在しない時は正常
            return;
        }

        const popup = await this.page.$(popupSel);
        if (!popup) {
            return;
        }
        const buttons = await this.page.$$('#outStamina a.btnShadow');
        while (buttons.length > 0) {
            const button = buttons.shift();
            const title = await this.page.evaluate((item: Element) => { return item.textContent; }, button);
            if (title === '使用する') {
                const buttonBox = await button.boundingBox();
                // 座標をクリック
                const mouse = await this.page.mouse;
                await mouse.click(buttonBox.x + 80, buttonBox.y + 20);
                const confirm = await this.page.$('#confirmPopOkBtn');
                const confirmBox = await confirm.boundingBox();
                await mouse.click(confirmBox.x + 80, confirmBox.y + 20);
                return;
            }
        }
        return;
    }

    /**
     *  ライフ（ハート）の数をカウントする
     *  @returns 現在のハートの数のプロミスオブジェクト(0-5)
     */
    async getHearts(): Promise<number> {
        const hearts = await this.page.$$('.inlineBlock.heartOn.js_heartOn');
        return hearts.length;
    }

    /**
     *  アピール相手がレアかどうか
     *  @returns booleanのPromise
     */
    async isRare(): Promise<boolean> {
        const rareSel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section.ofHidden > div > div.dropShadow.relative.z1 > div.table.fill.pt3.pb1 > div:nth-child(1) > img';
        try {
            await this.page.waitForSelector(rareSel, { timeout: 300 });
            return await this.page.$eval(rareSel, (item: Element) => {
                const src = (<HTMLImageElement>item).src;
                if (src.includes('icon_rare')) {
                    return true;
                }
                return false;
            });
        } catch (e) {
            // セレクタが存在しない時は通常
            return false;
        }
    }

    /**
     *  テンションゲージがMAXになっているかどうか
     *  @returns booleanのPromise
     */
    async isFullGauge(): Promise<boolean> {
        if (await this.page.$('.gaugeFullAnime')) {
            return true;
        }
        return false;
    }
}
