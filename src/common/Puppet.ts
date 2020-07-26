import config from '@/common/Config';
import Const from '@/common/Const';
import logger from '@/common/Logger';

import puppeteer from 'puppeteer-core';

class Puppet {
  // TODO: close()されていない場所があるかも？
  private static _browser: puppeteer.Browser;

  private static _page: puppeteer.Page;

  /**
   * プロセス全体の Puppeteer.Browser インスタンス
   */
  public static get browser(): puppeteer.Browser {
    return this._browser;
  }

  /**
   * プロセス全体の Puppeteer.Page インスタンス
   */
  public static get page(): puppeteer.Page {
    return this._page;
  }

  public static async initialize(): Promise<void> {
    const browser = await puppeteer.launch({
      args: config.get('chrome.args') as string[],
      defaultViewport: config.get('chrome.defaultViewport'),
      devtools: config.get('chrome.devtools'),
      executablePath: config.get('chrome.executablePath'),
      headless: config.get('chrome.headless'),
      slowMo: config.get('chrome.slowMo'),
      userDataDir: config.get('chrome.profilePath'),
    });

    // 接続終了時、ページ終了時にterminateを呼ぶ
    browser.on('disconnected', this.terminate);
    browser.on('targetdestroyed', this.terminate);

    // 基本的にページはひとつのみ
    const page = (await browser.pages())[0];

    // ダイアログはすべてOKで対応
    page.on('dialog', async (dialog) => {
      await dialog.accept();
      await page.reload();
    });

    this._browser = browser;
    this._page = page;

    // シグナルを受け取ったら終了処理
    process.on('SIGHUP', this.terminate);
    process.on('SIGINT', this.terminate);
    process.on('SIGTERM', this.terminate);

    await this.goBasePage();
  }

  public static async goBasePage(): Promise<void> {
    // ベースURL(ameba先頭)へ
    await this.page.goto(Const.BASE_URL, { waitUntil: 'networkidle2' });

    if (this.page.url().includes('user.ameba.jp')) {
      // dauth.user.ameba.jpへとURL遷移したらログインページと認識
      this.page.goto('https://dauth.user.ameba.jp/login/ameba');
      await this.page.waitForNavigation();

      // 手で入る
      await this.page.waitFor(300000);
      await this.page.waitForNavigation();
      return;
    }
  }

  /**
   *  SIGINT, SIGTERMを受け取った時にブラウザオブジェクトを閉じて完了する
   *  @returns 空のpromiseオブジェクト
   */
  private static async terminate(): Promise<void> {
    try {
      if (this._page) {
        await this._page.close();
      }
      if (this._browser) {
        await this._browser.close();
      }
    } catch (e) {
      logger.error(e.message + e.stack);
      throw e;
    } finally {
      process.exit(0);
    }
  }
}

export default Puppet;
