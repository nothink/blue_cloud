import { Command } from 'commander';

import RunnerBase from './runner/base/RunnerBase';
import ChampionshipRunner from './runner/ChampionshipRunner';
import StoryRunner from './runner/StoryRunner';
import StudyRunner from './runner/StudyRunner';

const command = new Command();

// commanderをセットアップ
command
  .option(
    '-r, --runner <type>',
    'Runner type(study, story, champ)',
    /^(study|story|champ)$/i
  )
  .option(
    '-s, --studytarget <type>',
    'Study target(level, ring)',
    /^(level|ring)$/i
  )
  .parse(process.argv);

/**
 * エントリーポイント
 */
async function main(): Promise<void> {
  let runner: RunnerBase;
  if (process.argv.length < 3) {
    process.stdout.write('usage: -r (study, story, champ) [-s (level, ring)]');
    return;
  }

  switch (command.runner) {
    case 'study':
      runner = new StudyRunner(command.studytarget) as RunnerBase;
      break;
    case 'story':
      runner = new StoryRunner() as RunnerBase;
      break;
    case 'champ':
      runner = new ChampionshipRunner() as RunnerBase;
      break;
    default:
      process.stdout.write(
        'usage: -r (study, story, champ) [-s (level, ring)]'
      );
      return;
  }

  await runner.run();

  return;
}

main();
