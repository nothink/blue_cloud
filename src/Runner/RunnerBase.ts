import * as puppeteer from 'puppeteer';
import * as defaultSettings from '../../default.settings.json';
import * as settings from '../../settings.json';

// merge settings.json to the default settings.
const conf = Object.assign(defaultSettings, settings);

export class RunnerBase {
  readonly conf = conf;
  browser!: puppeteer.Browser;
  page!: puppeteer.Page;

  constructor() {
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: this.conf.chrome.headless,
      devtools: this.conf.chrome.devtools,
      userDataDir: this.conf.chrome.profilePath,
      executablePath: this.conf.chrome.executablePath,
      slowMo: this.conf.chrome.slowMo,
      args: this.conf.chrome.args,
    });

    // close all exist pages.
    (await this.browser.pages()).forEach((p) => {
      p.close();
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 600, height: 900 });

    await this.page.goto(this.conf.baseUrl, { waitUntil: 'domcontentloaded' });
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
//    await this.page.screenshot({ path: 'vcard.png' });
  }

  async close() {
    (await this.browser.pages()).forEach((p) => {
      p.close();
    });
    await this.browser.close();
  }
}
