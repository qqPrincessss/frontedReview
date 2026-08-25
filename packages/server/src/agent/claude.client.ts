import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AGENT_CONFIG } from './agent.config';

@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 调用 Claude API 进行代码审查
   * 当前为 SDK 封装骨架，后续接入 @anthropic-ai/sdk
   */
  async query(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY 未配置');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= AGENT_CONFIG.maxRetries; attempt++) {
      try {
        const result = await this.callClaude(systemPrompt, userPrompt, apiKey);
        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Claude API 调用失败 (第 ${attempt + 1} 次): ${error.message}`,
        );

        if (attempt < AGENT_CONFIG.maxRetries) {
          await this.sleep(AGENT_CONFIG.retryDelay);
        }
      }
    }

    throw lastError || new Error('Claude API 调用失败');
  }

  private async callClaude(
    systemPrompt: string,
    userPrompt: string,
    _apiKey: string,
  ): Promise<string> {
    // TODO: 接入 @anthropic-ai/sdk 或 claude-agent-sdk
    // 当前返回占位，确保架构可编译
    //
    // 实际实现参考:
    // import Anthropic from '@anthropic-ai/sdk';
    // const client = new Anthropic({ apiKey });
    // const message = await client.messages.create({
    //   model: 'claude-sonnet-4-20250514',
    //   max_tokens: 4096,
    //   temperature: AGENT_CONFIG.temperature,
    //   system: systemPrompt,
    //   messages: [{ role: 'user', content: userPrompt }],
    // });

    this.logger.log('Claude API 调用（占位实现）');
    this.logger.debug(`System prompt length: ${systemPrompt.length}`);
    this.logger.debug(`User prompt length: ${userPrompt.length}`);

    throw new Error(
      'Claude API 尚未接入，请安装 @anthropic-ai/sdk 并实现 callClaude 方法',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
