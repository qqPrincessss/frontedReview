import { Command } from 'commander';
import {
  loginCommand,
  logoutCommand,
  registerCommand,
} from './commands/login';
import { feedbackCommand } from './commands/feedback';
import { historyCommand } from './commands/history';
import { reviewCommand } from './commands/review';
import { showCommand } from './commands/show';

const packageJson = require('../package.json') as { version: string };
const program = new Command();

program
  .name('review')
  .description('CodeReview AI - AI 驱动的前端代码审查工具')
  .version(packageJson.version);

program.addCommand(registerCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(reviewCommand);
program.addCommand(historyCommand);
program.addCommand(showCommand);
program.addCommand(feedbackCommand);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ ${message}`);
  process.exitCode = 1;
});
