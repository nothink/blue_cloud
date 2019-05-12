import RunnerBase from './RunnerBase';

import * as puppeteer from 'puppeteer';

// TODO: Abstract Factory パターンを用いてPhase生成を単純化したい
// https://refactoring.guru/design-patterns/abstract-factory/typescript/example

// TODO: スタイルガイドに合わせる
// https://typescript-jp.gitbook.io/deep-dive/styleguide
// http://cou929.nu/data/google_javascript_style_guide/

// TODO: 処理をパターン化してしまう
// https://qiita.com/rh_taro/items/32bb6851303cbc613124

/**
 *  Puppeteerを用いたランナースクリプトの
 *  単一の段階(単一URL遷移)で行う処理単位
 */
export default abstract class PhaseBase {
  protected runner!: RunnerBase;
  protected page!: puppeteer.Page;

  /**
   *  コンストラクタ
   */
  constructor(runner: RunnerBase) {
    this.runner = runner;
    this.page = runner.page;
  }

  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public abstract async proceed(): Promise<void>;
}
