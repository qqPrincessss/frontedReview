import chalk from 'chalk';
import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';

interface HistoryItem {
  id: string;
  summary?: string;
  overall_score?: number;
  status: string;
  created_at: string;
}

export const historyCommand = new Command('history')
  .description('查看审查历史记录')
  .option('--limit <number>', '显示条数', '10')
  .action(async (options: { limit: string }) => {
    const config = getConfig();
    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exitCode = 1;
      return;
    }

    try {
      const response = await apiClient.get('/reviews', {
        params: { limit: options.limit },
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const data = (response.data as { data: { items: HistoryItem[]; total: number } }).data;

      if (data.items.length === 0) {
        console.log('暂无审查记录');
        return;
      }

      console.log(`审查历史（共 ${data.total} 条）:\n`);
      data.items.forEach((item) => {
        const score = item.overall_score ?? '--';
        const date = new Date(item.created_at).toLocaleString();
        console.log(chalk.bold(`  [${score}/100] ${item.summary || '(无摘要)'}`));
        console.log(`  ${item.id} | ${item.status} | ${date}\n`);
      });
    } catch (error: unknown) {
      console.error(`✗ ${error instanceof Error ? error.message : '查询失败'}`);
      process.exitCode = 1;
    }
  });
