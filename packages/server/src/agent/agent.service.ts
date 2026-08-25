import { Injectable, BadRequestException } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result.parser';
import { ReviewResult } from './types';
import { AGENT_CONFIG } from './agent.config';

@Injectable()
export class AgentService {
  constructor(
    private readonly claudeClient: ClaudeClient,
    private readonly promptBuilder: PromptBuilder,
    private readonly resultParser: ResultParser,
  ) {}

  /**
   * 审查代码 diff
   * @param diff - git diff 原文
   * @param language - 代码语言
   * @returns 结构化审查结果
   */
  async reviewDiff(diff: string, language?: string): Promise<ReviewResult> {
    // 校验 diff 大小
    if (Buffer.byteLength(diff, 'utf-8') > AGENT_CONFIG.maxDiffSize) {
      throw new BadRequestException(
        `diff 内容过大，最大支持 ${AGENT_CONFIG.maxDiffSize / 1024}KB`,
      );
    }

    // 1. 组装 prompt
    const { system, user } = this.promptBuilder.build(diff, language);

    // 2. 调用 Claude
    const rawResponse = await this.claudeClient.query(system, user);

    // 3. 解析结果
    return this.resultParser.parse(rawResponse);
  }
}
