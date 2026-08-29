import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Review, ReviewIssue } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../database/prisma.service';

type ReviewWithIssues = Review & { issues: ReviewIssue[] };

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generatePdf(reviewId: string, userId: string): Promise<Buffer> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { issues: { orderBy: { ordinal: 'asc' } } },
    });

    if (!review) throw new NotFoundException('审查记录不存在');
    if (review.userId !== userId) {
      throw new ForbiddenException('无权访问此审查记录');
    }
    if (review.status !== 'COMPLETED') {
      throw new BadRequestException('只有已完成的审查可以导出 PDF');
    }

    const fontPath = this.resolveFontPath();
    if (!fontPath) {
      throw new ServiceUnavailableException(
        '未找到 PDF 中文字体，请通过 PDF_FONT_PATH 配置字体文件',
      );
    }

    return this.renderPdf(review, fontPath);
  }

  private renderPdf(review: ReviewWithIssues, fontPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: { Title: `CodeReview AI - ${review.id}` },
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      document.font(fontPath);
      document.fontSize(20).fillColor('#111827').text('CodeReview AI 审查报告');
      document.moveDown(0.8);
      document.fontSize(10).fillColor('#4b5563');
      document.text(`审查 ID：${review.id}`);
      document.text(`综合评分：${review.overallScore ?? 'N/A'}/100`);
      document.text(`语言：${review.language || '未知'}`);
      document.text(`分支：${review.branchFrom || '-'} → ${review.branchTo || '-'}`);
      document.text(`创建时间：${review.createdAt.toISOString()}`);

      this.writeSection(document, '摘要');
      document.fontSize(11).fillColor('#111827').text(review.summary || '暂无摘要');

      this.writeSection(document, '维度评分');
      const dimensions = this.asRecord(review.dimensionScores);
      if (dimensions) {
        Object.entries(dimensions).forEach(([name, value]) => {
          const dimension = this.asRecord(value);
          const score = dimension?.score ?? '-';
          const note = typeof dimension?.note === 'string' ? dimension.note : '';
          document.fontSize(10).text(`${name}：${score}/10${note ? ` — ${note}` : ''}`);
        });
      } else {
        document.fontSize(10).text('暂无维度评分');
      }

      this.writeSection(document, `问题列表（${review.issues.length}）`);
      if (review.issues.length === 0) {
        document.fontSize(10).text('本次审查未发现问题。');
      } else {
        review.issues.forEach((issue, index) => {
          document
            .fontSize(11)
            .fillColor('#111827')
            .text(`${index + 1}. [${issue.severity}] ${issue.dimension}`);
          document.fontSize(9).fillColor('#4b5563');
          document.text(`文件：${issue.filePath}${issue.lineRange ? `:${issue.lineRange}` : ''}`);
          document.text(`问题：${issue.what}`);
          document.text(`原因：${issue.why}`);
          document.text(`建议：${issue.suggestion}`);
          document.moveDown(0.7);
        });
      }

      document.end();
    });
  }

  private writeSection(document: PDFKit.PDFDocument, title: string): void {
    document.moveDown(1.2);
    document.fontSize(14).fillColor('#1f2937').text(title);
    document.moveDown(0.4);
  }

  private resolveFontPath(): string | undefined {
    const configured = this.configService.get<string>('PDF_FONT_PATH');
    const windowsDirectory = process.env.WINDIR || 'C:\\Windows';
    const candidates = [
      configured,
      join(windowsDirectory, 'Fonts', 'simhei.ttf'),
      join(windowsDirectory, 'Fonts', 'msyh.ttc'),
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/System/Library/Fonts/PingFang.ttc',
    ];

    return candidates.find((candidate): candidate is string =>
      Boolean(candidate && existsSync(candidate)),
    );
  }

  private asRecord(value: unknown): Record<string, any> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, any>)
      : undefined;
  }
}
