import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { getConfig } from '../utils/config';

interface FeedbackOptions {
  up?: boolean;
  down?: boolean;
  clear?: boolean;
  comment?: string;
}

interface FeedbackResponse {
  id: string;
  review_id: string;
  rating: 'up' | 'down';
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export const feedbackCommand = new Command('feedback')
  .description('查看、提交或清除审查反馈')
  .argument('<review-id>', '审查记录 ID')
  .option('--up', '认可本次审查')
  .option('--down', '认为本次审查不准确或无帮助')
  .option('-c, --comment <comment>', '反馈说明，最多 2000 个字符')
  .option('--clear', '清除已提交的反馈')
  .action(async (reviewId: string, options: FeedbackOptions) => {
    const validationError = validateOptions(options);
    if (validationError) {
      console.error(`✗ ${validationError}`);
      process.exitCode = 1;
      return;
    }

    const config = getConfig();
    if (!config.token) {
      console.error('✗ 请先登录：review login -u <username> -p <password>');
      process.exitCode = 1;
      return;
    }

    const path = `/reviews/${encodeURIComponent(reviewId)}/feedback`;
    const requestOptions = {
      headers: { Authorization: `Bearer ${config.token}` },
    };

    try {
      if (options.clear) {
        const response = await apiClient.delete(path, requestOptions);
        const result = (response.data as {
          data: { deleted: boolean };
        }).data;
        console.log(result.deleted ? '✓ 反馈已清除' : '该审查尚未提交反馈');
        return;
      }

      if (options.up || options.down) {
        const response = await apiClient.put(
          path,
          {
            rating: options.up ? 'UP' : 'DOWN',
            ...(options.comment !== undefined
              ? { comment: options.comment }
              : {}),
          },
          requestOptions,
        );
        console.log('✓ 反馈已保存');
        printFeedback(
          (response.data as { data: FeedbackResponse }).data,
        );
        return;
      }

      const response = await apiClient.get(path, requestOptions);
      printFeedback(
        (response.data as { data: FeedbackResponse | null }).data,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '反馈操作失败';
      console.error(`✗ ${message}`);
      process.exitCode = 1;
    }
  });

function validateOptions(options: FeedbackOptions): string | null {
  if (options.up && options.down) {
    return '--up 和 --down 不能同时使用';
  }

  if (options.clear && (options.up || options.down || options.comment !== undefined)) {
    return '--clear 不能与 --up、--down 或 --comment 同时使用';
  }

  if (options.comment !== undefined && !options.up && !options.down) {
    return '--comment 必须与 --up 或 --down 一起使用';
  }

  if (options.comment !== undefined && options.comment.length > 2000) {
    return 'comment 不能超过 2000 个字符';
  }

  return null;
}

function printFeedback(feedback: FeedbackResponse | null): void {
  if (!feedback) {
    console.log('该审查尚未提交反馈');
    return;
  }

  const rating = feedback.rating === 'up' ? '认可' : '不认可';
  console.log(`审查 ID: ${feedback.review_id}`);
  console.log(`评价: ${rating}`);
  console.log(`说明: ${feedback.comment || '无'}`);
  console.log(`更新时间: ${new Date(feedback.updated_at).toLocaleString()}`);
}
