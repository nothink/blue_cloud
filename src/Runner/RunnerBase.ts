import * as puppeteer from 'puppeteer';
import * as winston from 'winston';

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
    logger!: winston.Logger;
    isTerminated: boolean;

    abstract homeUrl: string;

    /**
     *  コンストラクタ
     */
    constructor() {
        this.logger = winston.createLogger({
            transports: [
                new winston.transports.File({
                    level: 'debug',
                    handleExceptions: true,
                    filename: 'log/runner.log',
                    maxsize: 128 * 1024,
                    tailable: true,
                    format: winston.format.combine(
                        winston.format.timestamp({
                            format: 'YYYY/MM/DD HH:mm:ss' }),
                        winston.format.json({ space: 4 }),
                    )}),
                new winston.transports.Console({
                    level: 'warn',
                    format: winston.format.combine(
                        winston.format.colorize({ all: true }),
                        winston.format.cli(),
                    )}),
            ],
        });
    }

    /**
     * SIGINT, SIGTERMを受け取った時にWebDriveerを閉じる
     */
    async terminate() {
        this.isTerminated = true;
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch (e) {
            console.log(e.stack);
            this.logger.error(e.message + e.stack);
            throw e;
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
            throw Error(
                `URL mismatch: ${this.conf.baseUrl} / ${this.page.url()}`,
            );
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
                await this.page.waitFor(100);
            } catch (e) {
                this.logger.error(e.message + e.stack);
                this.logger.error(e);
                await this.page.waitFor(300);
                await this.redo();
            }
        }
    }

    /**
     *  ページリロードする
     */
    async redo() {
        let response: puppeteer.Response;
        while (!response) {
            try {
                response = await this.page.reload({
                    timeout: 2000,
                    waitUntil: 'networkidle2' });
            } catch {
                response = null;
            } finally {
                if (!response || !response.ok()) {
                    response = null;
                }
                await this.page.waitFor(500);
            }
        }
    }

    /**
     *  ベースURLに戻る
     */
    async goBase() {
        await this.page.goto(this.conf.baseUrl, { waitUntil: 'networkidle2' });
    }
    /**
     *  各クラスごとのホームページに戻る
     */
    async goHome() {
        await this.page.goto(this.homeUrl, { waitUntil: 'networkidle2' });
    }

    /**
     *  エラーページの時飛ばす
     */
    async skipIfError() {
        const h1Sel = 'h1';
        try {
            await this.page.waitForSelector(h1Sel, { timeout: 800 });
        } catch {
            return;
        }
        const heading = await this.page.$eval(h1Sel, (h1: Element) => {
            return h1.textContent;
        });
        if (heading === 'エラー') {
            await this.page.waitFor(300);
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
