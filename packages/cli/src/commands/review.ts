import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';
import { detectLanguage, getCurrentBranch, getDiff } from '../utils/git';
import { printReview } from '../utils/output';

export const reviewCommand = new Command('submit')
  .description('提交当前代码变更进行 AI 审查')
  .option('--base <branch>', '基准分支', 'HEAD')
  .option('--head <branch>', '目标分支')
  .action(async (options: { base: string; head?: string }) => {
    const config = getConfig();
    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exitCode = 1;
      return;
    }

    const spinner = ora('正在采集 git diff...').start();
    try {
      const diff = await getDiff(options.base, options.head);
      if (!diff.trim()) {
        spinner.info('没有检测到代码变更');
        return;
      }

      const language = detectLanguage(diff);
      const branchTo = options.head || getCurrentBranch();
      spinner.text = `已采集 ${diff.split('\n').length} 行 diff，正在进行 AI 审查...`;

      const response = await apiClient.post(
        '/reviews',
        {
          diff,
          language,
          branch_from: options.base,
          branch_to: branchTo,
        },
        { headers: { Authorization: `Bearer ${config.token}` } },
      );

      spinner.succeed('审查完成');
      printReview((response.data as { data: any }).data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '审查失败';
      spinner.fail(message);
      process.exitCode = 1;
    }
  });
