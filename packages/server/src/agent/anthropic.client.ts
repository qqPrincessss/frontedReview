import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import {
  ModelClient,
  ModelDescriptor,
  ModelRequest,
  ModelResponse,
} from './model-client';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;

@Injectable()
export class AnthropicClient implements ModelClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const timeout = this.readIntegerConfig(
      'ANTHROPIC_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      1,
    );
    const maxRetries = this.readIntegerConfig(
      'ANTHROPIC_MAX_RETRIES',
      DEFAULT_MAX_RETRIES,
      0,
    );

    this.client = new Anthropic({
      apiKey: configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
      timeout,
      maxRetries,
    });
    this.model = configService.getOrThrow<string>('ANTHROPIC_MODEL');
  }

  describe(): ModelDescriptor {
    return {
      provider: 'anthropic',
      model: this.model,
    };
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        messages: request.messages,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      });

      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .filter((content) => content.length > 0)
        .join('\n');

      return {
        text,
        finishReason: response.stop_reason ?? undefined,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error: unknown) {
      throw this.toHttpException(error);
    }
  }

  private readIntegerConfig(
    name: string,
    fallback: number,
    minimum: number,
  ): number {
    const configured = this.configService.get<string | number>(name);
    if (configured === undefined || configured === '') {
      return fallback;
    }

    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`${name} 必须是大于或等于 ${minimum} 的整数`);
    }

    return value;
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof APIConnectionTimeoutError) {
      return new GatewayTimeoutException('Anthropic 请求超时，请稍后重试');
    }

    if (error instanceof RateLimitError) {
      return new ServiceUnavailableException(
        'Anthropic 服务当前请求过多，请稍后重试',
      );
    }

    if (error instanceof APIConnectionError) {
      return new BadGatewayException('无法连接 Anthropic 服务');
    }

    if (error instanceof APIError) {
      if (error.status === 401 || error.status === 403) {
        return new BadGatewayException(
          'Anthropic 鉴权失败，请检查服务端 API Key',
        );
      }

      const statusSuffix = error.status ? `（${error.status}）` : '';
      return new BadGatewayException(`Anthropic 请求失败${statusSuffix}`);
    }

    return new BadGatewayException('Anthropic 请求失败');
  }
}
