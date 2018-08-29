import * as Runner from './Runner/RunnerBase';

const runner = new Runner.RunnerBase();

async function main() {
  await runner.init();
  await runner.close();
}

main();
