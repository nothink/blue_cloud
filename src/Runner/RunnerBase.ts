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

    abstract homeUrl: string;

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
     * SIGINT, SIGTERMを受け取った時にWebDriveerを閉じる
     */
    async terminate() {
        this.logger.info('[TERM] Terminated.');
        this.isTerminated = true;
        try {
            this.logger.info('[TERM] closing...');
            if (this.browser) {
                await this.browser.close();
            }
        } catch (e) {
            this.logger.error(e);
        } finally {
            process.exit(0);
        }
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
        this.browser.on('disconnected', this.terminate);

        // クラッシュ等の対策で既存ページすべて閉じる
        (await this.browser.pages()).forEach((p) => {
            p.close();
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport(this.conf.viewport);

        await this.page.goto(this.conf.baseUrl, { waitUntil: 'networkidle0' });

        if (this.page.url().includes('dauth.user.ameba.jp')) {
            // dauth.user.ameba.jpへとURL遷移したらログインページと認識
            await this.page.waitFor('input[class="btn btn_primary large"]');
            this.page.click('input[class="btn btn_primary large"]');
            await this.page.waitForNavigation();

            await this.page.type(
                'input[name="accountId"]',
                settings.account.username,
            );
            await this.page.type(
                'input[name="password"]',
                settings.account.password,
            );

            this.page.click(
                'input[class="c-btn c-btn--large c-btn--primary"]',
            );
            await this.page.waitForNavigation();
            return;
        }

        if (this.page.url() !== this.conf.baseUrl) {
            // それ以外へのURL遷移を例外とみなす
            throw Error('URL mismatch: '
                +  this.conf.baseUrl
                + ' / ' + this.page.url());
        }
    }

    /**
     *  Runner全体を実行し、TERMシグナル等が送られるまで実行する
     */
    async run() {
        this.isTerminated = false;
        process.on('SIGHUP', this.terminate);
        process.on('SIGINT', this.terminate);
        process.on('SIGTERM', this.terminate);

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
     *  ページリロードする
     */
    async redo() {
        await this.page.reload({ timeout: 120, waitUntil: 'networkidle0' });
    }

    /**
     *  ベースURLに戻る
     */
    async goBase() {
        await this.page.goto(this.conf.baseUrl, { waitUntil: 'networkidle0' });
    }
    /**
     *  各クラスごとのホームページに戻る
     */
    async goHome() {
        await this.page.goto(this.homeUrl, { waitUntil: 'networkidle0' });
    }

    /**
     *  エラーページの時飛ばす
     */
    async skipIfError() {
        const h1 = await this.page.$('h1');
        if (!h1) return;
        const h1Text = await h1.getProperty('innerText');
        if (!h1Text) return;
        const h1Value = await h1Text.jsonValue();
        if (!h1Value) return;
        if (h1Value === 'エラー') {
            sleep.msleep(300);
            await this.goHome();
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
