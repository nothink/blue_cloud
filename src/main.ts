import RunnerBase from './Runner/RunnerBase';
import * as StudyRunner from './Runner/StudyRunner';
import * as StoryRunner from './Runner/StoryRunner';
import * as ChampionshipRunner from './Runner/ChampionshipRunner';

import * as program from 'commander';

program
    .option('-r, --runner <type>',
            'Runner type(study, story, champ)',
            /^(study|story|champ)$/i)
    .option('-s, --studytarget <type>',
            'Study target(level, ring)',
            /^(level|ring)$/i)
    .parse(process.argv);

async function main() {
    let runner: RunnerBase;
    if (process.argv.length < 3) {
        console.log('usage: -r (study, story) [-s (level, ring)]');
        return;
    }

    switch (program.runner) {
    case 'study':
        runner = new StudyRunner.StudyRunner(program.studytarget);
        break;
    case 'story':
        runner = new StoryRunner.StoryRunner();
        break;
    case 'champ':
        runner = new ChampionshipRunner.ChampionshipRunner();
        break;
    default:
        console.log('usage: -r (study, story, champ)');
        return;
    }

    if (runner) {
        await runner.init();
        await runner.run();
        await runner.close();
    }
}

main();