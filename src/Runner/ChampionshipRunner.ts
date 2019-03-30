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

        // 一時保存した発揮値をリストア
        const tmpPath = `config/${process.env.NODE_ENV}.tmp`;
        try {
            fs.statSync(tmpPath);
            this.expected = parseInt(fs.readFileSync(tmpPath, 'utf-8'), 10);
        } catch (e) {
            this.expected = undefined;
        }
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
        let promise: Promise<void>;
        switch (this.phase) {
        case 'quest':
            promise = this.walk();
            break;
        case 'encount-animation':
            promise = this.skipEncount();
            break;
        case 'user':
            promise = this.userBattle();
            break;
        case 'boss':
            promise = this.bossBattle();
            break;
        case 'battle-animation':
            promise = this.skipAnimation();
            break;
        case 'result':
            promise = this.skipResult();
            break;
        default:
            promise = this.goHome();
            break;
        }
        return promise;
    }

    /**
     *  カリスマのエリア歩行
     *  @returns 空のpromiseオブジェクト
     */
    async walk(): Promise<void> {
        // ボタン存在可否
        const button = await this.page.$('#js_btnFight');
        while (button) {
            // ダイアログが表示されている場合飛ばす
            await this.passDialog();

            // クリック可否性チェック
            let clickable: boolean;
            try {
                clickable = await this.page.$eval('#js_btnFight', (item: Element) => {
                    const cls = item.getAttribute('class');
                    if (cls.includes('btnFightOn')) {
                        return true;
                    }
                    return false;
                });
            } catch (e) {
                return;
            }
            if (clickable) {
                const buttonBox = await button.boundingBox();
                await this.page.mouse.click(buttonBox.x + 12, buttonBox.y + 12);

                const status = await Promise.all([
                    this.getHearts(),
                    this.getCurrentScene()]);
                // ゲージ満タンかのチェック
                const life = status[0];
                const scene = status[1];
                // アピールタイムで目標のライフを確保したかチェック
                const appealIcon = await this.page.$('.js_appealTime');
                if (scene === 'user' && life > 1) {
                    const iconBox = await appealIcon.boundingBox();
                    await this.page.mouse.click(iconBox.x + 7, iconBox.y + 7);
                    return;
                }
                if (scene === 'boss' && life === 5) {
                    const iconBox = await appealIcon.boundingBox();
                    await this.page.mouse.click(iconBox.x + 7, iconBox.y + 7);
                    return;
                }
            } else {
                // 0.1秒待機
                await this.page.waitFor(100);
            }
        }
    }

    /**
     *  対ユーザバトル処理
     *  @returns 空のpromiseオブジェクト
     */
    async userBattle(): Promise<void> {
        const mySel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatLeft.half > p:nth-child(2)';
        const tgtSel = 'body > div.gfContentBgFlower > div > div > div > div.gfOutlineFrame > div > section:nth-child(1) > div:nth-child(2) > div.clearfix.fcWhite.fs12.ph5.pt10 > div.floatRight.half.textRight > p:nth-child(2)';
        const status = await Promise.all([
            this.page.$eval(mySel, (item: Element) => { return Number(item.textContent); }),
            this.page.$eval(tgtSel, (item: Element) => { return Number(item.textContent); }),
            this.getHearts()]);

        const myAttack = status[0];
        const tgtAttack = status[1];
        const life = status[2];
        // ライフ消費は、自分の攻が相手の1.2倍だったら1つ、それ以外は2とする
        const needLife = (myAttack > tgtAttack * 1.2) ? 1 : 2;
        if (life < needLife) {
            // エリアに戻る
            this.goHome();
            return;
        }
        const buttonDivs = await this.page.$$('.js_heartSelectionBtn');
        const button = buttonDivs[needLife - 1];
        const buttonBox = await button.boundingBox();
        await this.page.mouse.click(buttonBox.x + 1, buttonBox.y + 1);
    }

    /**
     *  ボスバトル（アピールタイム）処理
     *  @returns 空のpromiseオブジェクト
     */
    async bossBattle(): Promise<void> {
        const isRare = await this.isRare();

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
            // バフ発動中は2倍計算
            const expectedNow = this.hasBuff() ? this.expected * 2 : this.expected;
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
        await this.page.mouse.click(buttonBox.x + 1, buttonBox.y + 1);
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
        try {
            const button = await this.page.$(selector);
            await button.click();
        } catch (e) {
            // ボタンなしは無視していい
            return;
        }
    }

    /**
     *  遭遇画面（ユーザ、アピール）をスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async skipEncount(): Promise<void> {
        const canvas = await this.page.$('#canvas');
        try {
            while (canvas) {
                // canvasが無くなるまでクリック
                await canvas.click();
                await this.page.waitFor(100);
            }
        } catch (e) {
            // canvas不在でここにくるはず
            return;
        }
    }

    // internal -----------------------------------------

    /**
     *  バー補給ダイアログの有無をチェックし、表示されている場合はバーを利用してスキップする
     *  @returns 空のpromiseオブジェクト
     */
    async passDialog(): Promise<void> {
        // スタミナ不足ダイアログの可否をチェック
        const display = await this.page.$eval('#outStamina', (item: Element) => {
            const style = item.getAttribute('style');
            if (style.includes('block')) {
                return true;
            }
            return false;
        });
        if (!display) {
            return;
        }

        const buttons = await this.page.$$('#outStamina a.btnShadow');
        while (buttons.length > 0) {
            const button = buttons.shift();
            const title = await this.page.evaluate((item: Element) => { return item.textContent; }, button);
            if (title === '使用する') {
                const buttonBox = await button.boundingBox();
                // 座標をクリック
                await this.page.mouse.click(buttonBox.x + 80, buttonBox.y + 20);
                const confirm = await this.page.$('#confirmPopOkBtn');
                const confirmBox = await confirm.boundingBox();
                await this.page.mouse.click(confirmBox.x + 80, confirmBox.y + 20);
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

    /**
     *  バフが発動中かどうか
     *  @returns booleanのPromise
     */
    async hasBuff(): Promise<boolean> {
        if (await this.page.$('.js_attackBuff')) {
            if (await this.page.$('.js_attackBuff.none')) {
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     *  アピールタイムに突入しているかどうかを確認して、どのアピールシーンかチェックする
     *  (走行中のみ)
     *  @returns stringのPromise (boss/user)かundefined
     */
    async getCurrentScene(): Promise<string> {
        if (await this.page.$('.js_appealTime')) {
            return await this.page.$eval('.js_appealTime', (item: Element) => {
                const href = (<HTMLAnchorElement>item).href;
                if (href.includes('boss')) {
                    return 'boss';
                }
                if (href.includes('user')) {
                    return 'user';
                }
            });
        }
        return undefined;
    }
}
