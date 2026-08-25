import { Injectable, Logger } from '@nestjs/common';
import { ReviewResult, DimensionScores } from './types';

@Injectable()
export class ResultParser {
  private readonly logger = new Logger(ResultParser.name);

  /**
   * 解析 Claude 返回的文本为结构化结果
   */
  parse(rawText: string): ReviewResult {
    const cleaned = this.cleanMarkdown(rawText);
    const json = this.safeJsonParse(cleaned);
    return this.validate(json);
  }

  private cleanMarkdown(text: string): string {
    let cleaned = text.trim();
    // 移除可能的 ```json ... ``` 包裹
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return cleaned;
  }

  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn('JSON 解析失败，尝试容错处理');

      // 尝试从文本中提取 JSON 块
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // 完全无法解析
        }
      }

      return this.fallbackResult(text);
    }
  }

  private validate(data: any): ReviewResult {
    return {
      summary: data.summary || '审查完成',
      overall_score: this.clamp(data.overall_score || 0, 0, 100),
      dimension_scores: this.validateDimensions(data.dimension_scores),
      issues: this.validateIssues(data.issues),
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
    };
  }

  private validateDimensions(scores: any): DimensionScores {
    const defaultDimension = { score: 0, note: '' };
    const dimensions = [
      'srp',
      'abstraction',
      'naming',
      'dry',
      'coupling',
      'readability',
      'consistency',
    ] as const;

    const result: any = {};
    for (const dim of dimensions) {
      if (scores && scores[dim]) {
        result[dim] = {
          score: this.clamp(scores[dim].score || 0, 0, 10),
          note: scores[dim].note || '',
        };
      } else {
        result[dim] = { ...defaultDimension };
      }
    }

    return result as DimensionScores;
  }

  private validateIssues(issues: any): ReviewResult['issues'] {
    if (!Array.isArray(issues)) return [];

    return issues
      .filter((issue: any) => issue && typeof issue === 'object')
      .map((issue: any) => ({
        file_path: issue.file_path || 'unknown',
        line_range: issue.line_range || '',
        severity: this.validateSeverity(issue.severity),
        dimension: issue.dimension || 'readability',
        what: issue.what || '',
        why: issue.why || '',
        suggestion: issue.suggestion || '',
      }));
  }

  private validateSeverity(
    severity: string,
  ): 'error' | 'warning' | 'info' {
    const valid = ['error', 'warning', 'info'];
    return valid.includes(severity) ? (severity as any) : 'warning';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private fallbackResult(rawText: string): any {
    this.logger.warn('使用降级结果');
    return {
      summary: '审查完成（结果解析异常，请查看原始输出）',
      overall_score: 0,
      dimension_scores: {},
      issues: [],
      highlights: [],
      _raw: rawText.substring(0, 500),
    };
  }
}
