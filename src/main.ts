import * as Runner from './Runner/StudyRunner';

import * as log4js from 'log4js';
import * as program from 'commander';

program
    .option('-r, --runner <type>',
            'Runner type(study, story)',
            /^(study|story)$/i)
    .option('-s, --studytarget <type>',
            'Study target(level, ring)',
            /^(level|ring)$/i)
    .parse(process.argv);

const logger = log4js.getLogger();
logger.level = 'debug';

async function main() {
    let runner;
    if (process.argv.length < 3) {
        console.log('usage: -r (study, story)');
        return;
    }

    switch (program.runner) {
    case 'study':
        console.log('study runner!');
        runner = new Runner.StudyRunner(program.studytarget);
        break;
    case 'story':
        console.log('story runner!');
        return;
    default:
        console.log('usage: -r (study, story)');
        return;
    }

    if (runner) {
        await runner.init();
        await runner.run();
        await runner.close();
    }

}

main();
