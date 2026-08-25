import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ClaudeClient } from './claude.client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result.parser';

@Module({
  providers: [AgentService, ClaudeClient, PromptBuilder, ResultParser],
  exports: [AgentService],
})
export class AgentModule {}
