import * as Runner from './Runner/StudyRunner';

import * as log4js from 'log4js';

const runner = new Runner.StudyRunner();

const logger = log4js.getLogger();
logger.level = 'debug';

async function main() {
    await runner.init();
    await runner.run();
    await runner.close();
}

main();
