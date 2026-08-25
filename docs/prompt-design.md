# Prompt 设计文档

## 概述

本工具的核心价值由 AI prompt 驱动。Prompt 设计直接决定审查结果的质量和一致性。

---

## 1. Prompt 组装流程

```
┌────────────────────────────────────────────────┐
│  最终发送给 Claude 的完整 prompt                  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ System Prompt                             │  │
│  │ (prompts/system.md)                       │  │
│  │                                          │  │
│  │ - 角色定义：资深前端架构师                   │  │
│  │ - 7 个审查维度 + 分数标准                   │  │
│  │ - 屎山信号清单                             │  │
│  │ - 审查规则（只审查 diff、不管格式等）        │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ Output Format                             │  │
│  │ (prompts/output-format.md)                │  │
│  │                                          │  │
│  │ - JSON 结构规范                           │  │
│  │ - 字段说明                                │  │
│  │ - severity 级别定义                       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ Few-shot Examples (校准锚点)               │  │
│  │                                          │  │
│  │ - bad-review.json   (32分 → 屎山)         │  │
│  │ - medium-review.json (62分 → 一般)        │  │
│  │ - good-review.json  (88分 → 优质)         │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ User Input                                │  │
│  │                                          │  │
│  │ "请审查以下 git diff：                     │  │
│  │  ```diff                                 │  │
│  │  {实际的 diff 内容}                        │  │
│  │  ```"                                    │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

---

## 2. 代码实现

```typescript
import { readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = join(__dirname, "../prompts");

function buildPrompt(diff: string, language?: string): { system: string; user: string } {
  // 加载 prompt 模板
  const system = readFileSync(join(PROMPTS_DIR, "system.md"), "utf-8");
  const outputFormat = readFileSync(join(PROMPTS_DIR, "output-format.md"), "utf-8");

  // 加载 few-shot 示例
  const badExample = readFileSync(join(PROMPTS_DIR, "examples/bad-review.json"), "utf-8");
  const mediumExample = readFileSync(join(PROMPTS_DIR, "examples/medium-review.json"), "utf-8");
  const goodExample = readFileSync(join(PROMPTS_DIR, "examples/good-review.json"), "utf-8");

  // 组装 system prompt
  const fullSystem = `${system}

${outputFormat}

# 校准示例

以下是不同分数档位的审查结果示例，用于帮助你校准打分标准：

## 低分示例 (32分 - 屎山级别)
${badExample}

## 中等示例 (62分 - 有待改进)
${mediumExample}

## 高分示例 (88分 - 优质代码)
${goodExample}
`;

  // 组装 user prompt
  const lang = language || "未知语言";
  const user = `请审查以下 ${lang} 代码的 git diff，按照你的审查维度进行评分和分析：

\`\`\`diff
${diff}
\`\`\``;

  return { system: fullSystem, user };
}
```

---

## 3. 分数校准策略

### 3.1 为什么需要校准

AI 打分的问题：
- 没有统一基线，每次调用标准可能不同
- 倾向于给中间分（5-7 分），区分度不够
- 相似代码两次审查可能分差 10+

### 3.2 校准手段

| 手段 | 作用 | 成本 |
|------|------|------|
| Few-shot 示例 | 建立分数锚点，最有效 | 低（一次性编写） |
| 明确分数区间 | 告诉 AI "1-3分=屎山，7-9分=良好" | 低 |
| temperature=0.3 | 减少随机性 | 无 |
| 用户反馈收集 | 积累数据优化 prompt | 中（需要前端支持） |
| 多次取中位数 | 更稳定但成本高 | 高（3x API 调用） |

### 3.3 当前方案

Phase 1 使用 few-shot + 分数定义，成本最低效果最好。

后续可加入：
- 用户对某次审查打 👍/👎，收集异常案例
- 积累 10+ 真实案例后替换初始 few-shot 示例

---

## 4. Prompt 维护原则

1. **可读性** — prompt 文件用 Markdown 写，方便维护和 review
2. **版本管理** — prompt 文件纳入 git，变更可追溯
3. **模块化** — system/format/examples 分开，单独修改不影响其他
4. **可测试** — 用固定 diff 跑 prompt，对比输出是否符合预期
5. **渐进优化** — 先上线，根据真实反馈迭代，不追求一步到位

---

## 5. 文件位置

```
packages/server/src/agent/prompts/
├── system.md              ← 角色 + 维度 + 规则
├── output-format.md       ← JSON 输出格式
└── examples/
    ├── bad-review.json    ← 32 分锚点
    ├── medium-review.json ← 62 分锚点
    └── good-review.json   ← 88 分锚点
```
