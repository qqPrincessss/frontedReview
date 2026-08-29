import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG } from './agent.config';

@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);

  constructor(private readonly configService: ConfigService) {}

  async query(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY 未配置');
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= AGENT_CONFIG.maxRetries; attempt++) {
      try {
        return await this.callClaude(systemPrompt, userPrompt, apiKey);
      } catch (error: unknown) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Claude API 调用失败（${attempt + 1}/${AGENT_CONFIG.maxRetries + 1}）：${message}`,
        );

        if (!this.isRetryable(error) || attempt === AGENT_CONFIG.maxRetries) {
          throw this.toHttpException(error);
        }

        await this.sleep(this.getRetryDelay(error, attempt));
      }
    }

    throw this.toHttpException(lastError);
  }

  private async callClaude(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
  ): Promise<string> {
    const client = new Anthropic({
      apiKey,
      maxRetries: 0,
      timeout: AGENT_CONFIG.timeout,
    });

    const message = await client.messages.create({
      model: this.configService.get<string>(
        'ANTHROPIC_MODEL',
        'claude-sonnet-4-5-20250929',
      ),
      max_tokens: AGENT_CONFIG.maxTokens,
      temperature: AGENT_CONFIG.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    if (!text) {
      throw new Error('Claude API 返回了空内容');
    }

    return text;
  }

  private isRetryable(error: unknown): boolean {
    const status = this.getStatus(error);
    return this.isTimeout(error) || status === 429 || (status !== undefined && status >= 500);
  }

  private getRetryDelay(error: unknown, attempt: number): number {
    const headers = this.getHeaders(error);
    const retryAfter = headers?.get?.('retry-after');
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;

    if (Number.isFinite(retryAfterSeconds)) {
      return Math.max(retryAfterSeconds * 1000, AGENT_CONFIG.retryDelay);
    }

    return AGENT_CONFIG.retryDelay * 2 ** attempt;
  }

  private toHttpException(error: unknown): Error {
    if (this.isTimeout(error)) {
      return new GatewayTimeoutException('Claude API 调用超时');
    }

    const status = this.getStatus(error);
    if (status === 429) {
      return new ServiceUnavailableException('Claude API 当前请求过多，请稍后重试');
    }

    return new BadGatewayException('Claude API 调用失败');
  }

  private isTimeout(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.name === 'AbortError' ||
      error.name === 'APIConnectionTimeoutError' ||
      /timed?\s*out|timeout/i.test(error.message)
    );
  }

  private getStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error)) {
      return undefined;
    }

    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  private getHeaders(error: unknown): Headers | undefined {
    if (typeof error !== 'object' || error === null || !('headers' in error)) {
      return undefined;
    }

    const headers = (error as { headers?: unknown }).headers;
    return headers instanceof Headers ? headers : undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
