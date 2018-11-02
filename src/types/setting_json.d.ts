declare module '*settings.json' {

    interface Chrome {
        executablePath: string;
        profilePath: string;
        headless: boolean;
        devtools: boolean;
        slowMo: number;
        args: string[];
    }

    interface Viewport {
        width: number;
        height: number;
    }

    interface Account {
        username: string;
        password: string;
    }

    interface Logger {
        isEnabled: boolean;
        path: string;
    }

    interface StudyConfig {
        testRank: number;
        usingSpark: boolean;
        usingSkill: boolean;
    }

    interface Setting {
        baseUrl: string;
        testHomeUrl: string;
        chrome: Chrome;
        viewport: Viewport;
        account: Account;
        logger: Logger;
        study: StudyConfig;
    }

    const value: Setting;
    export = value;
}
