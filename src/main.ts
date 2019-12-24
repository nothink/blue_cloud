import * as program from 'commander';

import RunnerBase from './runner/base/RunnerBase';
import ChampionshipRunner from './runner/ChampionshipRunner';
import StoryRunner from './runner/StoryRunner';
import StudyRunner from './runner/StudyRunner';

// commanderをセットアップ
program
  .option(
    '-r, --runner <type>',
    'Runner type(study, story, champ)',
    /^(study|story|champ)$/i,
  )
  .option(
    '-s, --studytarget <type>',
    'Study target(level, ring)',
    /^(level|ring)$/i,
  )
  .parse(process.argv);

/**
 * エントリーポイント
 */
async function main(): Promise<void> {
  let runner: RunnerBase;
  if (process.argv.length < 3) {
    //    console.log("usage: -r (study, story) [-s (level, ring)]");
    return;
  }

  switch (program.runner) {
    case 'study':
      runner = new StudyRunner(program.studytarget);
      break;
    case 'story':
      runner = new StoryRunner();
      break;
    case 'champ':
      runner = new ChampionshipRunner();
      break;
    default:
      console.log('usage: -r (study, story, champ');
      return;
  }

  if (runner) {
    await runner.init();
    await runner.run();
    return runner.close();
  }
  return;
}

main();
