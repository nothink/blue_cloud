import * as puppeteer from 'puppeteer';
import * as config from 'config';
import * as winston from 'winston';
import * as bunyan from 'bunyan';

/**
 *  Puppeteerを用いたランナースクリプトのベースクラス
 */
export default abstract class RunnerBase {
    browser!: puppeteer.Browser;
    page!: puppeteer.Page;
    mouse!: puppeteer.Mouse;
    logger!: bunyan;
    loggerOld!: winston.Logger;
    isTerminated: boolean;
    config: config.IConfig;

    baseUrl!: string;
    abstract homeUrl: string;

    /**
     *  コンストラクタ
     */
    constructor() {
        this.logger = bunyan.createLogger({
            name: 'blue_cloud',
            stream: process.stdout,
            level: 'info',
        });
        this.config = config;
        this.baseUrl = this.config.get('baseUrl');
    }

    /**
     *  SIGINT, SIGTERMを受け取った時にブラウザオブジェクトを閉じて完了する
     *  @returns 空のpromiseオブジェクト
     */
    async terminate(): Promise<void> {
        this.isTerminated = true;
        try {
            if (this.page) {
                await this.page.close();
            }
            if (this.browser) {
                await this.browser.close();
            }
        } catch (e) {
            this.logger.error(e.message + e.stack);
            throw e;
        } finally {
            process.exit(0);
        }
    }

    /**
     *  環境の初期化を行う
     *  @returns 空のpromiseオブジェクト
     */
    async init(): Promise<void> {
        this.logger.info('launching browser...');
        this.browser = await puppeteer.launch({
            headless: this.config.get('chrome.headless'),
            devtools: this.config.get('chrome.devtools'),
            userDataDir: this.config.get('chrome.profilePath'),
            executablePath: this.config.get('chrome.executablePath'),
            slowMo: this.config.get('chrome.slowMo'),
            args: this.config.get('chrome.args'),
        });
        // 終了時にterminateを呼ぶ
        this.browser.on('disconnected', this.terminate);

        // クラッシュ等の対策で既存ページすべて閉じる
        (await this.browser.pages()).forEach((p) => {
            p.close();
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport(this.config.get('viewport'));

        await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });

        if (this.page.url().includes('dauth.user.ameba.jp')) {
            // dauth.user.ameba.jpへとURL遷移したらログインページと認識
            await this.page.waitFor('input[class="btn btn_primary large"]');
            this.page.click('input[class="btn btn_primary large"]');
            await this.page.waitForNavigation();

            await this.page.type(
                'input[name="accountId"]',
                this.config.get('account.username'),
            );
            await this.page.type(
                'input[name="password"]',
                this.config.get('account.password'),
            );

            this.page.click(
                'input[class="c-btn c-btn--large c-btn--primary"]',
            );
            await this.page.waitForNavigation();
            return;
        }
        // ページ終了時にもterminateを呼ぶ
        this.browser.on('targetdestroyed', this.terminate);
    }

    /**
     *  Runner全体を実行し、TERMシグナル等が送られるまで実行する
     *  @returns 空のpromiseオブジェクト
     */
    async run(): Promise<void> {
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
                this.logger.warn(e.stack);
                console.log(e.stack);
                await this.page.waitFor(300);
                await this.redo();
            }
        }
    }

    /**
     *  ページリロードする
     *  @returns 空のpromiseオブジェクト
     */
    async redo(): Promise<void> {
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
     *  @returns 空のpromiseオブジェクト
     */
    async goBase(): Promise<void> {
        await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    }
    /**
     *  各クラスごとのホームページに戻る
     *  @returns 空のpromiseオブジェクト
     */
    async goHome(): Promise<void> {
        await this.page.goto(this.homeUrl, { waitUntil: 'networkidle2' });
    }

    /**
     *  エラーページの時、ページをスキップしてホーム指定したページに移動する
     *  @returns 空のpromiseオブジェクト
     */
    async skipIfError(): Promise<void> {
        try {
            const h1Sel = 'h1';
            if (await this.page.$(h1Sel)) {
                const heading = await this.page.$eval(h1Sel, (h1: Element) => {
                    return h1.textContent;
                });
                if (heading === 'エラー') {
                    await this.page.waitFor(300);
                    await this.goHome();
                }
            }
        } catch (e) {
            // 無い時はcanvasオンリーとか？
            return;
        }
    }

    /**
     *  ブラウザを閉じて終了処理を行う
     *  @returns 空のpromiseオブジェクト
     */
    async close(): Promise<void> {
        this.logger.info('closing browser...');
        await this.browser.close();
    }

    /**
     *  ループ実行の一単位 (abstract)
     *  @returns 空のpromiseオブジェクト
     */
    async abstract runOnce(): Promise<void>;
}
