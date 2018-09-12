import * as puppeteer from 'puppeteer';
import * as log4js from 'log4js';
import * as sleep from 'sleep';

import * as defaultSettings from '../../default.settings.json';
import * as settings from '../../settings.json';

// merge settings.json to the default settings.
const conf = Object.assign(defaultSettings, settings);

/**
 * Puppeteerを用いたランナースクリプトのベースクラス
 */
export default abstract class RunnerBase {
    readonly conf = conf;           /// 設定
    browser!: puppeteer.Browser;
    page!: puppeteer.Page;
    logger!: log4js.Logger;
    isTerminated: boolean;

    /**
     *  コンストラクタ
     */
    constructor() {
        log4js.configure({
            appenders: {
                console: { type: 'console' },
                file: {
                    type: 'dateFile',
                    filename: './log/runner.log',
                    pattern: '.yyyyMMdd-hhmmss',
                    encoding: 'utf-8',
                },
            },
            categories: {
                default: {
                    appenders: ['console', 'file'],
                    level: 'ALL',
                },
            },
        });
        this.logger = log4js.getLogger('default');
    }

    /**
     *  環境の初期化を行う
     */
    async init() {
        this.logger.info('launching browser...');
        this.browser = await puppeteer.launch({
            headless: this.conf.chrome.headless,
            devtools: this.conf.chrome.devtools,
            userDataDir: this.conf.chrome.profilePath,
            executablePath: this.conf.chrome.executablePath,
            slowMo: this.conf.chrome.slowMo,
            args: this.conf.chrome.args,
        });

        // クラッシュ等の対策で既存ページすべて閉じる
        (await this.browser.pages()).forEach((p) => {
            p.close();
        });

        this.page = await this.browser.newPage();
        await this.page.goto(this.conf.baseUrl, { waitUntil: 'networkidle2' });
        if (this.page.url() !== this.conf.baseUrl) {
            await this.page.waitFor('input[class="btn btn_primary large"]');
            this.page.click('input[class="btn btn_primary large"]');
            await this.page.waitForNavigation();

            await this.page.type('input[name="accountId"]',
                                 settings.account.username);
            await this.page.type('input[name="password"]',
                                 settings.account.password);

            this.page.click('input[class="c-btn c-btn--large c-btn--primary"]');
            await this.page.waitForNavigation();
        }
    }

    /**
     *  Runner全体を実行し、TERMシグナル等が送られるまで実行する
     */
    async run() {
        this.isTerminated = false;
        while (!this.isTerminated) {
            try {
                await this.skipIfError();
                await this.runOnce();
                sleep.msleep(100);
            } catch (e) {
                this.logger.error(e);
                sleep.msleep(500);
                await this.redo();
            }
        }
    }

    /**
     *  失敗時に再実行する
     */
    async redo() {
        await this.page.reload({ timeout: 120, waitUntil: 'networkidle2' });
        sleep.msleep(200);
    }

    /**
     *  ホームに戻る
     */
    async goHome() {
        await this.page.goto(this.conf.baseUrl, { waitUntil: 'networkidle2' });
        sleep.msleep(200);
    }

    /**
     *  エラーページの時飛ばす
     */
    async skipIfError() {
        const h1 = await (await this.page.$('h1')).getProperty('innerText');
        const h1Text = await h1.jsonValue();
        if (h1Text === 'エラー') {
            sleep.msleep(300);
            this.goHome();
        }
    }

    /**
     *  ブラウザを閉じて終了処理を行う
     */
    async close() {
        this.logger.info('closing browser...');
        await this.browser.close();
    }

    /**
     *  ループ実行の一単位 (abstract)
     */
    async abstract runOnce();
}
