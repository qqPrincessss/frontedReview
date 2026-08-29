import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';
import { printReview } from '../utils/output';

export const showCommand = new Command('show')
  .description('查看指定审查报告')
  .argument('<review-id>', '审查记录 ID')
  .action(async (reviewId: string) => {
    const config = getConfig();
    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exitCode = 1;
      return;
    }

    try {
      const response = await apiClient.get(`/reviews/${encodeURIComponent(reviewId)}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      printReview((response.data as { data: any }).data);
    } catch (error: unknown) {
      console.error(`✗ ${error instanceof Error ? error.message : '查询失败'}`);
      process.exitCode = 1;
    }
  });
