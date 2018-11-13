import RunnerBase from './RunnerBase';

export class StoryRunner extends RunnerBase {
    homeUrl: string;
    eventId!: number;
    questId!: number;
    usingSpecial: boolean;

    /**
     *  コンストラクタ
     */
    constructor() {
        super();

        // テスト勉強ホーム
        this.homeUrl = this.conf.storyHomeUrlBase;
    }

    /**
     *  ループ実行の一単位 (override)
     */
    async runOnce() {
        // TODO: memo
    }
}
