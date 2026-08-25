import { Command } from 'commander';
import { getDiff } from '../utils/git';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';

export const reviewCommand = new Command('submit')
  .description('提交当前代码变更进行 AI 审查')
  .option('--base <branch>', '基准分支', 'HEAD')
  .option('--head <branch>', '目标分支')
  .action(async (options) => {
    const config = getConfig();

    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exit(1);
    }

    console.log('正在采集 git diff...');

    try {
      // 1. 采集 diff
      const diff = await getDiff(options.base, options.head);

      if (!diff.trim()) {
        console.log('没有检测到代码变更');
        process.exit(0);
      }

      console.log(`采集到 ${diff.split('\n').length} 行 diff，正在提交审查...`);

      // 2. 提交审查
      const response = await apiClient.post(
        '/reviews',
        {
          diff,
          branch_from: options.base,
          branch_to: options.head,
        },
        {
          headers: { Authorization: `Bearer ${config.token}` },
        },
      );

      const result = response.data.data;

      // 3. 输出结果
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`  综合评分: ${result.overallScore}/100`);
      console.log(`  摘要: ${result.summary}`);
      console.log('═══════════════════════════════════════');

      if (result.issues && result.issues.length > 0) {
        console.log('');
        console.log(`发现 ${result.issues.length} 个问题:`);
        console.log('');

        result.issues.forEach((issue: any, index: number) => {
          const icon =
            issue.severity === 'ERROR'
              ? '✗'
              : issue.severity === 'WARNING'
                ? '!'
                : 'i';
          console.log(
            `  ${icon} [${issue.severity}] ${issue.filePath}:${issue.lineRange || ''}`,
          );
          console.log(`    ${issue.what}`);
          console.log(`    建议: ${issue.suggestion}`);
          console.log('');
        });
      }

      if (result.highlights && result.highlights.length > 0) {
        console.log('亮点:');
        result.highlights.forEach((h: string) => console.log(`  ✓ ${h}`));
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message || error.message || '审查失败';
      console.error(`✗ ${message}`);
      process.exit(1);
    }
  });
