import RunnerBase from './RunnerBase';

import { ElementHandle } from 'puppeteer';
import * as url from 'url';

export class StoryRunner extends RunnerBase {
    homeUrl: string;
    eventId!: number;
    questId!: number;
    usingSpecial: boolean;

    /**
     *  コンストラクタ
     */
    constructor() {
        super();

        this.eventId = this.config.get('story.eventId');
        this.questId = this.config.get('story.questId');
        this.usingSpecial = this.config.get('story.usingSpecial');

        // テスト勉強ホーム
        this.homeUrl = `${this.config.get('storyHomeUrlBase')}?eventId=${this.eventId}&questId=${this.questId}`;
    }

    /**
     *  現在の状態
     *  @returns    状態を表す文字列
     *      quest (http://vcard.ameba.jp/story/quest?eventId=37&questId=3): ふむふむ状態
     *      discovery-animation (http://vcard.ameba.jp/story/quest/discovery-animation?eventId=37&questId=3&stageId=6&type=0&token=OPOu6v) : 差し入れタイム開始
     *      event (http://vcard.ameba.jp/story/quest/event?eventId=37&questId=3) : 差し入れ選択
     *      event-animation (http://vcard.ameba.jp/story/quest/event-animation?eventId=37&questId=3&token=n2YDGc) : 差し入れ結果
     *      levelup-animation (確認中) : レベルアップアニメーション
     *      event-result　(http://vcard.ameba.jp/story/quest/event-result?eventId=37&questId=3) : リザルト画面
     */
    get phase(): string {
        const current = url.parse(this.page.url());
        if (!current || !current.path || current.path === '/') {
            // 初回、ないしは該当なしの場合は空ステータス
            return '';
        }
        const fragms = current.pathname.split('/');
        // 基本的にfragmentの末尾で判定するためpop()
        const ftail = fragms.pop();
        return ftail;
    }

    /**
     *  ループ実行の一単位 (override)
     */
    async runOnce() {
        // Phaseで切り替える
        switch (this.phase) {
        case 'quest':
            await this.listenQuest();
            break;
        case 'discovery-animation':
            await this.passDiscoveryAnimation();
            break;
        case 'event':
            await this.selectEventItem();
            break;
        case 'event-animation':
            await this.passEventAnimation();
            break;
        case 'levelup-animation':
            await this.passLevelupAnimation();
            break;
        case 'event-result':
            await this.checkEventResult();
            break;

        default:
            await this.goHome();
            this.logger.debug('[ Go quest home ]');
            break;
        }
    }

    async listenQuest() {
        // ダイアログが表示されている場合飛ばす
        await this.passDialog();

        const button = await this.page.$('.questTouchArea');
        const buttonBox = await button.boundingBox();
        // 座標をクリック
        const mouse = await this.page.mouse;
        await mouse.click(buttonBox.x + 280, buttonBox.y + 280);
    }

    async passDiscoveryAnimation() {
        await this.page.waitFor(2100);
    }

    async selectEventItem() {
        // ラブラブタイムの時間を取りに行き、取れたら保持、取れなかったらラブラブタイム以外
        let sec = 0;
        let isLoveLove: boolean;
        try {
            const area = await this.page.$('.loveloveModeTime');
            const timestr = await this.page.evaluate((elem) => { return elem.textContent; }, area);
            const times = timestr.split(':');
            sec = parseInt(times[0], 10) * 60 + parseInt(times[1], 10);
            isLoveLove = true;
        } catch (e) {
            isLoveLove = false;
        }
        // フィーバー（ラブラブ差し入れ）かのチェック
        const isFever = await this.page.$eval('h1', (elem) => {
            return elem.getAttribute('class') === 'eventFeverTitle';
        });

        if (isLoveLove && isFever && (sec < 50) && this.usingSpecial) {
            this.logger.debug('NEXT 10 min...');
            console.log(`Wait ${sec + 5}sec.`);
            await this.page.waitFor((sec + 5) * 1000);
            console.log('Use item.');
            const button = await this.page.$('#js_openItemPopup');
            await button.click();
            await this.page.waitFor(200);
            const confirm = await this.page.$('#js_specialItemButton');
            confirm.click();
        } else {
            const button = await this.page.$('#js_normalItemButton');
            await button.click();
        }
    }

    async passEventAnimation() {
        const canvas = await this.page.$('#canvas');
        const canvasBox = await canvas.boundingBox();
        const mouse = await this.page.mouse;
        // 座標をクリック
        await mouse.click(canvasBox.x + 300, canvasBox.y + 400);
    }

    async passLevelupAnimation() {
        const canvas = await this.page.$('#canvas');
        await canvas.click();
    }

    async checkEventResult() {
        const button = await this.page.$('.btnPrimary');
        await button.click();
    }

    async passDialog() {
        const popupSel = '.popup#outStamina[style*="block"]';
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
        const button = await this.page.$('#outStamina a.btnShadow');
        const title = await this.page.evaluate((item: Element) => { return item.textContent; }, button);
        if (title === '使用する') {
            const buttonBox = await button.boundingBox();
            // 座標をクリック
            const mouse = await this.page.mouse;
            await mouse.click(buttonBox.x + 80, buttonBox.y + 20);
            const confirm = await this.page.$('#confirmPopOkBtn');
            const confirmBox = await confirm.boundingBox();
            await mouse.click(confirmBox.x + 80, confirmBox.y + 20);
        }

        return;
    }
}
