import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';

export const historyCommand = new Command('history')
  .description('查看审查历史记录')
  .option('--limit <number>', '显示条数', '10')
  .action(async (options) => {
    const config = getConfig();

    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exit(1);
    }

    try {
      const response = await apiClient.get('/reviews', {
        params: { limit: options.limit },
        headers: { Authorization: `Bearer ${config.token}` },
      });

      const { items, total } = response.data.data;

      if (items.length === 0) {
        console.log('暂无审查记录');
        return;
      }

      console.log(`审查历史（共 ${total} 条，显示最近 ${items.length} 条）:`);
      console.log('');

      items.forEach((item: any) => {
        const date = new Date(item.createdAt).toLocaleString();
        const score = item.overallScore ?? '--';
        console.log(
          `  [${score}/100] ${item.summary || '(无摘要)'} (${date})`,
        );
        console.log(`         ID: ${item.id} | ${item.status}`);
        console.log('');
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message || error.message || '查询失败';
      console.error(`✗ ${message}`);
      process.exit(1);
    }
  });
