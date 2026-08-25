import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { reviewCommand } from './commands/review';
import { historyCommand } from './commands/history';

const program = new Command();

program
  .name('review')
  .description('CodeReview AI - AI 驱动的前端代码审查工具')
  .version('0.1.0');

// 注册子命令
program.addCommand(loginCommand);
program.addCommand(reviewCommand);
program.addCommand(historyCommand);

program.parse(process.argv);
