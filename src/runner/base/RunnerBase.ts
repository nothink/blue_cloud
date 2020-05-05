import Const from '@/common/Const';
import logger from '@/common/Logger';
import Puppet from '@/common/Puppet';

/**
 *  Puppeteerを用いたランナースクリプトのベースクラス
 */
export default abstract class RunnerBase {
  /** 各RunnerのホームURL */
  protected abstract homeUrl: string;

  /**
   *  現在の状態 (abstract)
   *  @returns    状態を表す文字列
   */
  abstract get phase(): string;

  /**
   *  Runner全体を実行し、TERMシグナル等が送られるまで実行する
   *  @returns 空のpromiseオブジェクト
   */
  public async run(): Promise<void> {
    await Puppet.initialize();

    while (!Puppet.page.isClosed()) {
      try {
        await this.skipIfError();
        await this.runOnce();
        await Puppet.page.waitFor(100); // 基本感覚は 0.1s
      } catch (e) {
        logger.warn(e.stack);
        await Puppet.page.waitFor(300);
        await this.redo();
      }
    }
  }

  /**
   *  ページリロードする
   *  @returns 空のpromiseオブジェクト
   */
  public async redo(): Promise<void> {
    for (;;) {
      try {
        const response = await Puppet.page.reload({
          timeout: 20000,
          waitUntil: 'networkidle2',
        });
        if (response.ok()) {
          break;
        }
      } catch (e) {
        logger.error('exeption:');
        logger.error(e.message);
      } finally {
        await Puppet.page.waitFor(500);
      }
    }
  }

  /**
   *  ベースとなるURL(トップページ)に戻る
   *  @returns 空のpromiseオブジェクト
   */
  public async goBaseHome(): Promise<void> {
    await Puppet.page.goto(Const.BASE_URL, { waitUntil: 'networkidle2' });
  }

  /**
   *  各クラスごとのホームページに戻る
   *  @returns 空のpromiseオブジェクト
   */
  public async goHome(): Promise<void> {
    await Puppet.page.goto(this.homeUrl, { waitUntil: 'networkidle2' });
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
      if (await Puppet.page.$(h1Sel)) {
        const heading = await Puppet.page.$eval(h1Sel, (h1: Element) => {
          return h1.textContent;
        });
        if (heading === 'エラー') {
          await Puppet.page.waitFor(300);
          await this.goHome();
        }
      }
    } catch (e) {
      // 無い時はcanvasオンリーとか？
      return;
    }
  }
}
