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
        // エラーページを飛ばす
        await this.skipError();
        // Navigation待機
        // TODO: どうしてもここは落ちがち
        // TODO: なので例外キャッチを明確に行いたい
        await Promise.all([
          Puppet.page.waitForNavigation({
            timeout: 28429,
            waitUntil: 'networkidle2',
          }),
          this.runOnce(),
        ]);

        await Puppet.page.waitForTimeout(200); // 0.2s
      } catch (e) {
        logger.warn(e.stack);
        await Puppet.page.waitForTimeout(220);
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
          timeout: 5000,
          waitUntil: 'networkidle2',
        });
        if (response.ok()) {
          break;
        }
      } catch (e) {
        logger.error('exeption:');
        logger.error(e.message);
      } finally {
        await Puppet.page.waitForTimeout(500);
      }
    }
  }

  /**
   *  ベースとなるURL(トップページ)に戻る
   *  @returns 空のpromiseオブジェクト
   */
  public async goBasePage(): Promise<void> {
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
  protected abstract runOnce(): Promise<void>;

  /**
   *  エラーページの時、ページをスキップしてホーム指定したページに移動する
   *  @returns 空のpromiseオブジェクト
   */
  private async skipError(): Promise<void> {
    // canvasページはエラーになりえない
    const canvasSel = 'canvas';
    if (await Puppet.page.$(canvasSel)) {
      return;
    }
    // エラーの判定はh1の中身でのみ行える
    const h1Sel = 'h1';
    const handle = await Puppet.page.$(h1Sel);
    if (handle) {
      const heading = await handle.evaluate((h1: Element) => {
        return h1.textContent;
      });
      if (heading === 'エラー') {
        // エラーページはh1にエラーとだけある
        await Puppet.page.waitForTimeout(100);
        await this.goHome();
      }
    }
  }
}
