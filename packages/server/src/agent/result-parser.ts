import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  ReviewDimension,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from './types';

const REVIEW_DIMENSIONS: readonly ReviewDimension[] = [
  'srp',
  'abstraction',
  'naming',
  'dry',
  'coupling',
  'readability',
  'consistency',
];

const REVIEW_SEVERITIES: readonly ReviewSeverity[] = [
  'error',
  'warning',
  'info',
];

@Injectable()
export class ResultParser {
  parse(rawText: string): ReviewResult {
    const text = this.removeMarkdownFence(rawText);
    let value: unknown;

    try {
      value = JSON.parse(text) as unknown;
    } catch {
      throw new BadGatewayException('模型返回的内容不是合法 JSON');
    }

    if (!this.isReviewResult(value)) {
      throw new BadGatewayException('模型返回的审查结果格式无效');
    }

    return value;
  }

  private removeMarkdownFence(rawText: string): string {
    const text = rawText.trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1]?.trim() ?? text;
  }

  private isReviewResult(value: unknown): value is ReviewResult {
    if (!this.isRecord(value)) return false;

    return (
      this.isNonEmptyString(value.summary) &&
      this.isIntegerInRange(value.overall_score, 0, 100) &&
      this.isDimensionScores(value.dimension_scores) &&
      Array.isArray(value.issues) &&
      value.issues.every((issue) => this.isReviewIssue(issue)) &&
      Array.isArray(value.highlights) &&
      value.highlights.every((highlight) =>
        this.isNonEmptyString(highlight),
      )
    );
  }

  private isDimensionScores(value: unknown): boolean {
    if (!this.isRecord(value)) return false;

    return REVIEW_DIMENSIONS.every((dimension) => {
      const score = value[dimension];
      return (
        this.isRecord(score) &&
        this.isIntegerInRange(score.score, 1, 10) &&
        this.isNonEmptyString(score.note)
      );
    });
  }

  private isReviewIssue(value: unknown): value is ReviewIssue {
    if (!this.isRecord(value)) return false;

    return (
      this.isNonEmptyString(value.file_path) &&
      typeof value.line_range === 'string' &&
      this.isReviewSeverity(value.severity) &&
      this.isReviewDimension(value.dimension) &&
      this.isNonEmptyString(value.what) &&
      this.isNonEmptyString(value.why) &&
      this.isNonEmptyString(value.suggestion)
    );
  }

  private isReviewSeverity(value: unknown): value is ReviewSeverity {
    return (
      typeof value === 'string' &&
      REVIEW_SEVERITIES.includes(value as ReviewSeverity)
    );
  }

  private isReviewDimension(value: unknown): value is ReviewDimension {
    return (
      typeof value === 'string' &&
      REVIEW_DIMENSIONS.includes(value as ReviewDimension)
    );
  }

  private isIntegerInRange(
    value: unknown,
    minimum: number,
    maximum: number,
  ): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= minimum &&
      value <= maximum
    );
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
