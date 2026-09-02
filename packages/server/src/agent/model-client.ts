export const MODEL_CLIENT = Symbol('MODEL_CLIENT');

export type ModelRole = 'user' | 'assistant';

export interface ModelMessage {
  role: ModelRole;
  content: string;
}

export interface ModelRequest {
  systemPrompt?: string;
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelResponse {
  text: string;
  finishReason?: string;
  usage?: ModelUsage;
}

export interface ModelDescriptor {
  readonly provider: string;
  readonly model: string;
}

export interface ModelClient {
  describe(): ModelDescriptor;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

