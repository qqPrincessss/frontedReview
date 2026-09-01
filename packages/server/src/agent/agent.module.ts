import { Module, NotImplementedException } from '@nestjs/common';
import { AgentService } from './agent.service';
import { MODEL_CLIENT, ModelClient } from './model-client';
import { PromptBuilder } from './prompt.builder';
import { ResultParser } from './result-parser';

const unconfiguredModelClient: ModelClient = {
  generate: () =>
    Promise.reject(new NotImplementedException('模型客户端尚未实现')),
};

@Module({
  providers: [
    AgentService,
    PromptBuilder,
    ResultParser,
    {
      provide: MODEL_CLIENT,
      useValue: unconfiguredModelClient,
    },
  ],
  exports: [AgentService],
})
export class AgentModule {}
