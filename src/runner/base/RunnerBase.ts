import * as bunyan from 'bunyan';
import * as config from 'config';
import * as puppeteer from 'puppeteer-core';

/**
 *  Puppeteerを用いたランナースクリプトのベースクラス
 */
export default abstract class RunnerBase {
  public logger!: bunyan;
  public page!: puppeteer.Page;

  protected browser!: puppeteer.Browser;
  protected mouse!: puppeteer.Mouse;
  protected isTerminated!: boolean;
  protected config: config.IConfig;

  protected baseUrl: string;
  protected abstract homeUrl: string;

  /**
   *  コンストラクタ
   */
  constructor() {
    this.logger = bunyan.createLogger({
      level: 'info',
      name: 'blue_cloud',
      stream: process.stdout,
    });
    this.config = config;
    this.baseUrl = this.config.get('baseUrl');
  }

  /**
   *  現在の状態 (abstract)
   *  @returns    状態を表す文字列
   */
  abstract get phase(): string;

  /**
   *  環境の初期化を行う
   *  @returns 空のpromiseオブジェクト
   */
  public async init(): Promise<void> {
    this.logger.debug('launching browser...');
    this.browser = await puppeteer.launch({
      args: this.config.get('chrome.args') as string[],
      defaultViewport: this.config.get('chrome.defaultViewport'),
      devtools: this.config.get('chrome.devtools'),
      executablePath: this.config.get('chrome.executablePath'),
      headless: this.config.get('chrome.headless'),
      slowMo: this.config.get('chrome.slowMo'),
      userDataDir: this.config.get('chrome.profilePath'),
    });
    // 終了時にterminateを呼ぶ
    this.browser.on('disconnected', this.terminate);

    this.page = (await this.browser.pages())[0];
    // ダイアログはすべてOK
    this.page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // ベースURL(ameba先頭)へ
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });

    if (this.page.url().includes('user.ameba.jp')) {
      // dauth.user.ameba.jpへとURL遷移したらログインページと認識
      this.page.goto('https://dauth.user.ameba.jp/login/ameba');
      await this.page.waitForNavigation();

      await this.page.type(
        "input[name='accountId']",
        this.config.get('account.username'),
      );
      await this.page.type(
        "input[name='password']",
        this.config.get('account.password'),
      );

      this.page.click("input[type='submit']");
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
  public async run(): Promise<void> {
    this.isTerminated = false;
    process.on('SIGHUP', this.terminate);
    process.on('SIGINT', this.terminate);
    process.on('SIGTERM', this.terminate);

    while (!this.isTerminated) {
      try {
        await this.skipIfError();
        await this.runOnce(); // アクションひとつ
        await this.page.waitFor(100);
      } catch (e) {
        this.logger.warn(e.stack);
        await this.page.waitFor(300);
        await this.redo();
      }
    }
  }

  /**
   *  ブラウザを閉じて終了処理を行う
   *  @returns 空のpromiseオブジェクト
   */
  public async close(): Promise<void> {
    this.logger.info('closing browser...');
    await this.browser.close();
  }

  /**
   *  ページリロードする
   *  @returns 空のpromiseオブジェクト
   */
  public async redo(): Promise<void> {
    for (;;) {
      try {
        const response = await this.page.reload({
          timeout: 20000,
          waitUntil: 'networkidle2',
        });
        if (response.ok()) {
          break;
        }
      } catch (e) {
        this.logger.error('exeption:');
        this.logger.error(e.message);
      } finally {
        await this.page.waitFor(500);
      }
    }
  }

  /**
   *  ベースとなるURL(トップページ)に戻る
   *  @returns 空のpromiseオブジェクト
   */
  public async goBaseHome(): Promise<void> {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
  }

  /**
   *  各クラスごとのホームページに戻る
   *  @returns 空のpromiseオブジェクト
   */
  protected async goHome(): Promise<void> {
    await this.page.goto(this.homeUrl, { waitUntil: 'networkidle2' });
  }

  /**
   *  ループ実行の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  protected abstract async runOnce(): Promise<void>;

  /**
   *  エラーページの時、ページをスキップしてホーム指定したページに移動する
   *  @returns 空のpromiseオブジェクト
   */
  private async skipIfError(): Promise<void> {
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
   *  SIGINT, SIGTERMを受け取った時にブラウザオブジェクトを閉じて完了する
   *  @returns 空のpromiseオブジェクト
   */
  private async terminate(): Promise<void> {
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
}
