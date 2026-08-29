import { BadGatewayException, Injectable } from '@nestjs/common';
import { DimensionScores, ReviewResult } from './types';

@Injectable()
export class ResultParser {
  parse(rawText: string): ReviewResult {
    const json = this.safeJsonParse(this.cleanMarkdown(rawText));
    return this.validate(json);
  }

  private cleanMarkdown(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1] : trimmed;
  }

  private safeJsonParse(text: string): unknown {
    const candidates = [text, text.match(/\{[\s\S]*\}/)?.[0]].filter(
      (candidate): candidate is string => Boolean(candidate),
    );

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // 继续尝试下一个候选 JSON 块。
      }
    }

    throw new BadGatewayException('AI 返回内容无法解析为 JSON');
  }

  private validate(data: unknown): ReviewResult {
    if (!this.isRecord(data)) {
      throw new BadGatewayException('AI 返回结果格式不正确');
    }

    const overallScore = Number(data.overall_score);
    if (!Number.isFinite(overallScore)) {
      throw new BadGatewayException('AI 返回结果缺少有效的 overall_score');
    }

    return {
      summary:
        typeof data.summary === 'string' && data.summary.trim()
          ? data.summary.trim()
          : '审查完成',
      overall_score: this.clamp(overallScore, 0, 100),
      dimension_scores: this.validateDimensions(data.dimension_scores),
      issues: this.validateIssues(data.issues),
      highlights: Array.isArray(data.highlights)
        ? data.highlights.filter(
            (highlight): highlight is string => typeof highlight === 'string',
          )
        : [],
    };
  }

  private validateDimensions(scores: unknown): DimensionScores {
    const source = this.isRecord(scores) ? scores : {};
    const dimensions = [
      'srp',
      'abstraction',
      'naming',
      'dry',
      'coupling',
      'readability',
      'consistency',
    ] as const;

    return Object.fromEntries(
      dimensions.map((dimension) => {
        const value = source[dimension];
        const score = this.isRecord(value) ? Number(value.score) : 0;
        const note =
          this.isRecord(value) && typeof value.note === 'string' ? value.note : '';

        return [
          dimension,
          {
            score: Number.isFinite(score) ? this.clamp(score, 0, 10) : 0,
            note,
          },
        ];
      }),
    ) as unknown as DimensionScores;
  }

  private validateIssues(issues: unknown): ReviewResult['issues'] {
    if (!Array.isArray(issues)) return [];

    return issues.filter(this.isRecord).map((issue) => ({
      file_path:
        typeof issue.file_path === 'string' ? issue.file_path : 'unknown',
      line_range:
        typeof issue.line_range === 'string' ? issue.line_range : '',
      severity: this.validateSeverity(issue.severity),
      dimension:
        typeof issue.dimension === 'string' ? issue.dimension : 'readability',
      what: typeof issue.what === 'string' ? issue.what : '',
      why: typeof issue.why === 'string' ? issue.why : '',
      suggestion:
        typeof issue.suggestion === 'string' ? issue.suggestion : '',
    }));
  }

  private validateSeverity(value: unknown): 'error' | 'warning' | 'info' {
    return value === 'error' || value === 'warning' || value === 'info'
      ? value
      : 'warning';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
