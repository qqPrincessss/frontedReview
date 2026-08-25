# Agent 服务设计文档

## 1. 定位

Agent 是本项目的核心引擎——所有代码审查的智能能力都来自这一层。它不是后端的一个附属模块，而是一个独立的服务层，负责与 Claude AI 交互并产出结构化审查报告。

```
┌────────────────────────────────────────────────────────────────────┐
│                          NestJS 后端                                │
│                                                                    │
│  Controller → Service → ┌──────────────────────────────────────┐   │
│                         │         Agent Service                 │   │
│                         │                                      │   │
│                         │  这是整个产品的"大脑"                   │   │
│                         │  所有智能能力在这里                     │   │
│                         │                                      │   │
│                         └──────────────────┬───────────────────┘   │
│                                            │                       │
└────────────────────────────────────────────│───────────────────────┘
                                             │ Claude Agent SDK
                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Claude AI (Anthropic)                        │
│                                                                    │
│  接收 prompt → 理解代码 → 分析问题 → 输出结构化 JSON                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent 内部架构

```
packages/server/src/agent/
├── agent.module.ts            ← NestJS 模块注册
├── agent.service.ts           ← 对外暴露的服务接口
├── claude.client.ts           ← Claude Agent SDK 封装（底层通信）
├── prompt.builder.ts          ← Prompt 组装器（拼接 system + format + examples + input）
├── result.parser.ts           ← 结果解析器（JSON 提取 + 容错 + 校验）
├── types.ts                   ← Agent 层的类型定义
└── prompts/                   ← Prompt 模板文件
    ├── system.md
    ├── output-format.md
    └── examples/
        ├── bad-review.json
        ├── medium-review.json
        └── good-review.json
```

---

## 3. 核心组件

### 3.1 AgentService（对外接口）

Review 模块唯一调用的入口。隐藏所有 AI 交互细节。

```typescript
@Injectable()
export class AgentService {
  constructor(
    private claudeClient: ClaudeClient,
    private promptBuilder: PromptBuilder,
    private resultParser: ResultParser,
  ) {}

  /**
   * 审查代码 diff
   * @param diff - git diff 原文
   * @param language - 代码语言
   * @returns 结构化审查结果
   */
  async reviewDiff(diff: string, language?: string): Promise<ReviewResult> {
    // 1. 组装 prompt
    const { system, user } = this.promptBuilder.build(diff, language);

    // 2. 调用 Claude
    const rawResponse = await this.claudeClient.query(system, user);

    // 3. 解析结果
    return this.resultParser.parse(rawResponse);
  }
}
```

### 3.2 ClaudeClient（SDK 封装）

封装 `@anthropic-ai/claude-agent-sdk` 的底层调用，处理：
- SDK 初始化和配置
- 流式响应收集
- 超时和重试
- 错误处理和降级

```typescript
@Injectable()
export class ClaudeClient {
  private readonly maxRetries = 2;
  private readonly timeout = 60_000; // 60s

  /**
   * 调用 Claude Agent SDK 的 query()
   * 收集流式响应，返回完整文本
   */
  async query(systemPrompt: string, userPrompt: string): Promise<string> {
    let assistantText = "";

    const stream = query({
      prompt: userPrompt,
      options: {
        systemPrompt,
        maxTurns: 1,           // 审查只需要一轮
        allowedTools: [],       // 不需要工具，只做文本分析
      },
    });

    for await (const message of stream) {
      // 收集 assistant 回复的文本
      if (message.type === "assistant") {
        assistantText += extractText(message);
      }
    }

    return assistantText;
  }
}
```

### 3.3 PromptBuilder（Prompt 组装）

职责：加载模板文件，组装最终发送给 Claude 的完整 prompt。

```typescript
@Injectable()
export class PromptBuilder {
  private system: string;
  private outputFormat: string;
  private examples: { bad: string; medium: string; good: string };

  constructor() {
    // 启动时加载模板（只加载一次）
    this.system = loadFile("prompts/system.md");
    this.outputFormat = loadFile("prompts/output-format.md");
    this.examples = {
      bad: loadFile("prompts/examples/bad-review.json"),
      medium: loadFile("prompts/examples/medium-review.json"),
      good: loadFile("prompts/examples/good-review.json"),
    };
  }

  build(diff: string, language?: string): { system: string; user: string } {
    const system = `${this.system}

${this.outputFormat}

# 校准示例
## 低分 (32分)
${this.examples.bad}
## 中等 (62分)
${this.examples.medium}
## 高分 (88分)
${this.examples.good}`;

    const lang = language || "未知";
    const user = `请审查以下 ${lang} 代码的 git diff：\n\`\`\`diff\n${diff}\n\`\`\``;

    return { system, user };
  }
}
```

### 3.4 ResultParser（结果解析）

职责：从 Claude 的原始文本中提取 JSON，做容错和校验。

```typescript
@Injectable()
export class ResultParser {
  /**
   * 解析 Claude 返回的文本为结构化结果
   * 处理各种异常情况：markdown 包裹、格式不完整、字段缺失
   */
  parse(rawText: string): ReviewResult {
    const cleaned = this.cleanMarkdown(rawText);
    const json = this.safeJsonParse(cleaned);
    return this.validate(json);
  }

  private cleanMarkdown(text: string): string {
    // 移除可能的 ```json ... ``` 包裹
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return cleaned;
  }

  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      // JSON 解析失败，尝试修复常见问题（尾逗号等）
      // 最终失败则返回默认结构
      return this.fallbackResult(text);
    }
  }

  private validate(data: any): ReviewResult {
    // 确保所有字段存在且类型正确
    return {
      summary: data.summary || "审查完成",
      overall_score: clamp(data.overall_score || 0, 0, 100),
      dimension_scores: this.validateDimensions(data.dimension_scores),
      issues: this.validateIssues(data.issues),
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
    };
  }
}
```

---

## 4. 调用时序图

```
ReviewService              AgentService         PromptBuilder      ClaudeClient       ResultParser
     │                          │                     │                  │                  │
     │  reviewDiff(diff, lang)  │                     │                  │                  │
     │─────────────────────────>│                     │                  │                  │
     │                          │                     │                  │                  │
     │                          │  build(diff, lang)  │                  │                  │
     │                          │────────────────────>│                  │                  │
     │                          │                     │                  │                  │
     │                          │  { system, user }   │                  │                  │
     │                          │<────────────────────│                  │                  │
     │                          │                     │                  │                  │
     │                          │  query(system, user)│                  │                  │
     │                          │───────────────────────────────────────>│                  │
     │                          │                     │                  │                  │
     │                          │                     │     Claude Agent SDK stream         │
     │                          │                     │                  │ ─── ─── ─── ──>  │
     │                          │                     │                  │  (10-20s)        │
     │                          │                     │                  │ <── ─── ─── ───  │
     │                          │                     │                  │                  │
     │                          │  rawText            │                  │                  │
     │                          │<───────────────────────────────────────│                  │
     │                          │                     │                  │                  │
     │                          │  parse(rawText)     │                  │                  │
     │                          │─────────────────────────────────────────────────────────>│
     │                          │                     │                  │                  │
     │                          │  ReviewResult       │                  │                  │
     │                          │<─────────────────────────────────────────────────────────│
     │                          │                     │                  │                  │
     │       ReviewResult       │                     │                  │                  │
     │<─────────────────────────│                     │                  │                  │
```

---

## 5. 错误处理策略

| 错误类型 | 处理方式 | 返回给上层 |
|---------|---------|-----------|
| Claude API 超时 | 重试 1 次，间隔 2s | 若仍失败 → 抛异常，review status=failed |
| Claude API 限流 (429) | 等待 retry-after 后重试 | 若仍失败 → 抛异常 |
| Claude 返回非 JSON | ResultParser 容错，尝试提取 | 若完全无法解析 → 返回默认结构 + 原文 |
| Claude 返回 JSON 字段缺失 | validate 方法填充默认值 | 正常返回（降级但不报错） |
| SDK 初始化失败 | 启动时检测，阻止服务启动 | 服务无法启动 → 运维告警 |
| API Key 无效 | 首次调用时发现 | 抛异常，review status=failed |

---

## 6. 性能与限制

| 指标 | 值 | 说明 |
|------|---|------|
| 单次审查耗时 | 10-30s | 取决于 diff 大小和 Claude 负载 |
| diff 大小上限 | 100KB | 超出则截断或拒绝 |
| 并发审查数 | 5 | 避免 Claude API 限流 |
| 单次 token 消耗 | ~2000-8000 | 取决于 diff 大小 |
| 重试次数 | 2 | 超时或 5xx 时重试 |

---

## 7. 配置项

```typescript
// agent.config.ts
export const AGENT_CONFIG = {
  // Claude SDK
  maxTurns: 1,                    // 审查只需一轮对话
  allowedTools: [],               // 不使用工具
  temperature: 0.3,               // 低温度，输出更稳定

  // 超时与重试
  timeout: 60_000,                // 60s 超时
  maxRetries: 2,                  // 最多重试 2 次
  retryDelay: 2_000,              // 重试间隔 2s

  // 限制
  maxDiffSize: 100 * 1024,        // diff 最大 100KB
  maxConcurrent: 5,               // 最大并发数

  // Prompt
  promptsDir: "src/agent/prompts", // prompt 模板目录
};
```

---

## 8. 后续演进

| 阶段 | 能力 | 说明 |
|------|------|------|
| v1 (当前) | 单次同步审查 | MVP，prompt + 同步等结果 |
| v2 | 异步审查 + 队列 | diff 大时不阻塞请求 |
| v3 | 多 Agent 协作 | 一个 Agent 审架构，一个审命名，合并报告 |
| v4 | 学习用户偏好 | 根据用户反馈调整审查严格度和关注维度 |
| v5 | 增量审查 | 只审查本次变更相对上次审查的增量 |

---

## 9. 与后端的边界

```
后端（Review Service）的职责：
├── 接收请求、校验参数
├── 存储 diff 和审查结果到数据库
├── 管理审查状态（pending → completed/failed）
└── 返回结果给客户端

Agent Service 的职责：
├── 组装 prompt
├── 调用 Claude SDK
├── 解析和校验 AI 输出
├── 错误处理和重试
└── 不关心数据库、不关心 HTTP、不关心认证
```

**Agent 只做一件事：接收 diff 字符串，返回结构化审查结果。** 不碰数据库，不碰 HTTP，不碰认证。这保证了它可以被独立测试、独立替换（比如未来换成 GPT 或本地模型）。
