import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AnthropicClient } from './anthropic.client';
import { MODEL_CLIENT } from './model-client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result-parser';
import { SkillLoader } from './skill.loader';

@Module({
  providers: [
    AgentService,
    AnthropicClient,
    PromptBuilder,
    ResultParser,
    SkillLoader,
    {
      provide: MODEL_CLIENT,
      useExisting: AnthropicClient,
    },
  ],
  exports: [AgentService],
})
export class AgentModule {}
