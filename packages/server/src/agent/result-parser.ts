import { BadGatewayException, Injectable } from '@nestjs/common';
import { isReviewResult } from './review-result.validator';
import { ReviewResult } from './types';

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

    if (!isReviewResult(value)) {
      throw new BadGatewayException('模型返回的审查结果格式无效');
    }

    return value;
  }

  private removeMarkdownFence(rawText: string): string {
    const text = rawText.trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1]?.trim() ?? text;
  }
}
