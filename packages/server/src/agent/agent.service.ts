import { Inject, Injectable } from '@nestjs/common';
import {
  MODEL_CLIENT,
  type ModelClient,
} from './model-client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result-parser';
import { ReviewResult } from './types';

@Injectable()
export class AgentService {
  constructor(
    private readonly promptBuilder: PromptBuilder,

    @Inject(MODEL_CLIENT)
    private readonly modelClient: ModelClient,

    private readonly resultParser: ResultParser,
  ) {}

  async reviewDiff(
    diff: string,
    language?: string,
  ): Promise<ReviewResult> {
    const prompt = this.promptBuilder.build(diff, language);

    const response = await this.modelClient.generate({
      systemPrompt: prompt.system,
      messages: [
        {
          role: 'user',
          content: prompt.user,
        },
      ],
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.resultParser.parse(response.text);
  }
}
