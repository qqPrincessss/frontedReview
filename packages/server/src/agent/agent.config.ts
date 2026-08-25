import { AgentConfig } from './types';

export const AGENT_CONFIG: AgentConfig = {
  // Claude SDK
  maxTurns: 1,
  allowedTools: [],
  temperature: 0.3,

  // 超时与重试
  timeout: 60_000,
  maxRetries: 2,
  retryDelay: 2_000,

  // 限制
  maxDiffSize: 100 * 1024, // 100KB
  maxConcurrent: 5,

  // Prompt 模板目录
  promptsDir: 'src/agent/prompts',
};
