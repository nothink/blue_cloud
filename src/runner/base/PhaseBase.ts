import StudyRunner from '../StudyRunner';

import puppeteer from 'puppeteer-core';

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
export interface PhaseBase {
  page: puppeteer.Page;

  /**
   *  単一処理の一単位 (interface)
   *  @returns 空のpromiseオブジェクト
   */
  proceed(): Promise<void>;
}

export abstract class StudyPhase implements PhaseBase {
  public page!: puppeteer.Page;
  protected runner: StudyRunner;

  /**
   *  コンストラクタ
   */
  constructor(runner: StudyRunner) {
    this.runner = runner;
    this.page = runner.page;
  }

  /**
   *  単一処理の一単位 (abstract)
   *  @returns 空のpromiseオブジェクト
   */
  public abstract async proceed(): Promise<void>;
}
