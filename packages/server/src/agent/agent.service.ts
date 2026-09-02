import { Inject, Injectable } from '@nestjs/common';
import {
  MODEL_CLIENT,
  ModelClient,
  ModelRequest,
  ModelResponse,
} from './model-client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result-parser';
import { ReviewResult } from './types';

const REVIEW_TEMPERATURE = 0.3;
const REVIEW_MAX_TOKENS = 4096;

export interface AgentRunDescriptor {
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly parameters: Readonly<
    Record<string, string | number | boolean | null>
  >;
}

export interface AgentExecutionMetrics {
  readonly latencyMs: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly finishReason?: string;
}

export type AgentExecutionOutcome =
  | {
      readonly ok: true;
      readonly result: ReviewResult;
      readonly parseStatus: 'SUCCEEDED';
      readonly metrics: AgentExecutionMetrics;
    }
  | {
      readonly ok: false;
      readonly stage: 'MODEL';
      readonly error: unknown;
      readonly parseStatus: null;
      readonly metrics: AgentExecutionMetrics;
    }
  | {
      readonly ok: false;
      readonly stage: 'PARSE';
      readonly error: unknown;
      readonly parseStatus: 'FAILED';
      readonly metrics: AgentExecutionMetrics;
    };

export interface PreparedReviewCall {
  readonly descriptor: AgentRunDescriptor;
  execute(): Promise<AgentExecutionOutcome>;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly promptBuilder: PromptBuilder,

    @Inject(MODEL_CLIENT)
    private readonly modelClient: ModelClient,

    private readonly resultParser: ResultParser,
  ) {}

  prepareReviewDiff(diff: string, language?: string): PreparedReviewCall {
    const prompt = this.promptBuilder.build(diff, language);
    const model = this.modelClient.describe();
    const request: ModelRequest = {
      systemPrompt: prompt.system,
      messages: [
        {
          role: 'user',
          content: prompt.user,
        },
      ],
      temperature: REVIEW_TEMPERATURE,
      maxTokens: REVIEW_MAX_TOKENS,
    };

    return {
      descriptor: {
        provider: model.provider,
        model: model.model,
        promptVersion: prompt.version,
        parameters: {
          temperature: REVIEW_TEMPERATURE,
          maxTokens: REVIEW_MAX_TOKENS,
        },
      },
      execute: () => this.executeReview(request),
    };
  }

  private async executeReview(
    request: ModelRequest,
  ): Promise<AgentExecutionOutcome> {
    const startedAt = Date.now();
    let response: ModelResponse;

    try {
      response = await this.modelClient.generate(request);
    } catch (error: unknown) {
      return {
        ok: false,
        stage: 'MODEL',
        error,
        parseStatus: null,
        metrics: {
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    const metrics: AgentExecutionMetrics = {
      latencyMs: Date.now() - startedAt,
      ...(response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          }
        : {}),
      ...(response.finishReason
        ? { finishReason: response.finishReason }
        : {}),
    };

    try {
      return {
        ok: true,
        result: this.resultParser.parse(response.text),
        parseStatus: 'SUCCEEDED',
        metrics,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        stage: 'PARSE',
        error,
        parseStatus: 'FAILED',
        metrics,
      };
    }
  }
}
