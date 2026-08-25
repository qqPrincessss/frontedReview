import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(reviewId: string, userId: string): Promise<Buffer> {
    // 查询审查记录
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { issues: true },
    });

    if (!review) {
      throw new NotFoundException('审查记录不存在');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('无权访问此审查记录');
    }

    // TODO: 使用 pdfkit 或 puppeteer 生成 PDF
    // 当前返回占位实现
    const content = this.buildReportContent(review);
    return Buffer.from(content, 'utf-8');
  }

  private buildReportContent(review: any): string {
    const lines: string[] = [];

    lines.push('=== CodeReview AI 审查报告 ===');
    lines.push('');
    lines.push(`审查 ID: ${review.id}`);
    lines.push(`综合评分: ${review.overallScore || 'N/A'}/100`);
    lines.push(`状态: ${review.status}`);
    lines.push(`语言: ${review.language || '未知'}`);
    lines.push(`创建时间: ${review.createdAt}`);
    lines.push('');

    if (review.summary) {
      lines.push(`摘要: ${review.summary}`);
      lines.push('');
    }

    if (review.issues && review.issues.length > 0) {
      lines.push('--- 问题列表 ---');
      review.issues.forEach((issue: any, index: number) => {
        lines.push('');
        lines.push(`#${index + 1} [${issue.severity}] ${issue.dimension}`);
        lines.push(`  文件: ${issue.filePath}`);
        if (issue.lineRange) {
          lines.push(`  行号: ${issue.lineRange}`);
        }
        lines.push(`  问题: ${issue.what}`);
        lines.push(`  原因: ${issue.why}`);
        lines.push(`  建议: ${issue.suggestion}`);
      });
    }

    return lines.join('\n');
  }
}
