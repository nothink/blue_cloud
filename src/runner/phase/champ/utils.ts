import Puppet from '@/common/Puppet';

export default class Utils {
  /**
   *  ライフ（ハート）の数をカウントする
   *  @returns 現在のハートの数のプロミスオブジェクト(0-5)
   */
  static async GetHearts(): Promise<number> {
    const hearts = await Puppet.page.$$('.inlineBlock.heartOn.js_heartOn');
    return Promise.resolve(hearts.length);
  }
}
