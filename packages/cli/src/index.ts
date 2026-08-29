import { Command } from 'commander';
import { loginCommand, logoutCommand } from './commands/login';
import { reviewCommand } from './commands/review';
import { historyCommand } from './commands/history';
import { showCommand } from './commands/show';

const program = new Command();

program
  .name('review')
  .description('CodeReview AI - AI 驱动的前端代码审查工具')
  .version('0.1.0');

// 注册子命令
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(reviewCommand);
program.addCommand(historyCommand);
program.addCommand(showCommand);

program.parse(process.argv);
