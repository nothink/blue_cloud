declare module '*settings.json' {

    interface Chrome {
        executablePath: string;
        profilePath: string;
        headless: boolean;
        devtools: boolean;
        slowMo: number;
        args: string[];
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
        usingSpark: boolean;
        usingSkill: boolean;
    }

    interface Setting {
        baseUrl: string;
        chrome: Chrome;
        account: Account;
        logger: Logger;
        study: StudyConfig;
    }

    const value: Setting;
    export = value;
}
