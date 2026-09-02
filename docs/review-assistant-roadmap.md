# Review 助手演进路线

> 状态：提案（Roadmap）
> 适用范围：CodeReview AI 的 CLI、服务端、Agent、未来 Bot/Web/IDE 客户端
> 本文描述后续演进决策，不代表所列能力已经实现。

## 1. 目的

当前项目已经跑通以下核心链路：

```text
CLI 采集 git diff
  → NestJS API + JWT
  → 单 Agent 调用 Anthropic
  → 结构化结果解析
  → Prisma 保存 Review / ReviewIssue
  → CLI 展示详情与历史
```

Prompt 已完成外置模板、输出协议和 32/62/88 三档评分校准。下一阶段的主要问题不再是继续堆 Prompt，而是让模型获得更可信的证据、让确定性工具参与判断、让结果可评测，并在扩展渠道时守住代码与凭证安全边界。

本文对以下七类方向做取舍：

1. 上下文增强
2. 静态分析集成
3. 团队规范与 RAG
4. 多 Agent
5. Auto-Fix
6. 反馈闭环
7. CLI、PR Bot、Web、IDE 等交互形态

## 2. 当前实现基线

| 能力 | 当前状态 | 说明 |
|------|----------|------|
| CLI 本地审查 | 已实现 | 支持注册、登录、提交 diff、历史和详情 |
| 单 Agent 同步审查 | 已实现 | 输入只有 diff 和语言，调用结束后同步返回 |
| Prompt 模块 | 已实现 | system、output format、三档 few-shot、评分公式 |
| 结构化结果 | 已实现 | summary、七维评分、issues、highlights |
| Review 持久化 | 已实现 | 保存 diff、评分、问题、状态和错误信息 |
| ReviewRun | 已实现 | 记录 provider、model、Prompt 版本、参数、token、延迟、解析状态和错误 |
| ReviewFeedback | 已实现 | 支持 JWT 保护的 API 与 CLI 查看、UP/DOWN、评论和清除 |
| 上下文采集 | 未实现 | 未发送完整文件、符号、配置或历史信息 |
| 静态分析 | 未实现 | 未编排 ESLint、TypeScript 或 AST 工具 |
| 团队规则 / RAG | 未实现 | 无团队、规则集、知识源或向量检索模型 |
| 多 Agent | 未实现 | 无子任务、并发、聚合或冲突处理 |
| Auto-Fix | 未实现 | 输出只有文字 suggestion，无 patch 协议 |
| PR Bot / Web / IDE | 未实现 | 当前唯一完整入口是 CLI |

数据库事实以 `packages/server/prisma/schema.prisma` 为准。未来能力不能因为已经存在数据表或设计图就被标记为“已实现”。

## 3. 决策摘要

| 方向 | 决策 | 优先级 | 核心理由 |
|------|------|--------|----------|
| 上下文增强 | 近期采纳 | P1 | 当前 coupling、consistency 等判断缺少完整文件与项目配置证据 |
| 静态分析 | 近期采纳 | P1 | 让确定性工具发现事实，AI 负责解释和决策 |
| 团队规范 | 有条件采纳 | P2 | 先做仓库内规则文件和可引用规则，再考虑 RAG |
| 向量 RAG | 暂缓 | P3 | 当前没有团队租户、知识治理和检索评测基础 |
| 多 Agent | 暂缓 | P3 | 单 Agent 尚无质量、成本和反馈基线，多 Agent 会先放大复杂度 |
| Auto-Fix Level 1 | 近期采纳 | P1 | 输出局部建议代码，但不直接修改工作树 |
| Auto-Fix Level 2 | 有条件采纳 | P2 | 生成可追溯、可预览、绑定 base SHA 的候选 patch |
| 自动 apply/commit/push | 不采纳默认自动化 | - | 必须由用户显式确认并在本地验证，禁止无人值守直接推送 |
| 反馈闭环 | 近期采纳 | P0 | 已有数据模型，是降低误报和评估 Prompt 的最短路径 |
| CLI 强化 | 近期采纳 | P0/P1 | 最适合本地上下文采集、静态分析和安全应用 patch |
| PR Bot | 有条件采纳 | P2 | 需要先有异步任务、幂等、commit SHA 和最小权限 |
| Web Dashboard | 有条件采纳 | P2 | 适合历史、反馈、规则和趋势，不负责本地仓库采集 |
| IDE 插件 | 暂缓 | P3 | 等 API、上下文和 patch 协议稳定后再复用，避免重复实现 |

## 4. 设计原则

### 4.1 Local-first Context

仓库读取、静态分析和 patch 应用优先发生在开发者本地或隔离 Worker。服务端不主动克隆用户仓库，不执行来自仓库的任意脚本。

### 4.2 Deterministic before Agentic

能由 TypeScript、ESLint、AST 或安全扫描器确定的问题，先由工具产生事实；AI 负责：

- 结合业务上下文解释影响
- 去重和排序
- 判断是否值得阻断
- 给出可执行建议

AI 不替代 linter，也不伪造 linter 结果。

### 4.3 Evidence and Provenance

每条结论应逐步具备来源：

- `ai`
- `typescript`
- `eslint`
- `team_rule`
- `security_scanner`

工具发现必须保留 `rule_id`、文件位置、工具版本和原始严重级别。团队规则命中必须返回规则 ID、版本和引用。

### 4.4 Human in the Loop

任何修改工作树、依赖、CI、提交或远端分支的动作都必须由用户显式确认。模型生成内容只能作为候选变更，不能直接获得 Git、Shell 或网络写权限。

### 4.5 Minimum Data Exposure

只发送完成当前审查所需的最小代码上下文。所有上传内容都应可预览、可限制、可排除，并受保留和删除策略约束。

### 4.6 Version Everything

至少记录：

- model/provider
- Prompt 版本
- 输出 Schema 版本
- Context Envelope 版本
- 静态工具及版本
- 团队规则版本
- diff 对应的 commit/base SHA

没有版本信息的反馈不能可靠用于评测或回归。

## 5. 七类方向的具体取舍

### 5.1 上下文增强：近期采纳

#### 第一阶段采纳

CLI 在本地生成受预算约束的 `ReviewContextEnvelope`：

- 变更文件的有限完整内容或相关片段
- imports、exports、类型和相邻函数签名
- 与变更直接相关的 `package.json`、`tsconfig.json` 配置片段
- 内容来源、仓库相对路径、内容哈希和裁剪原因
- 被排除文件和上下文缺失说明

推荐初始限制：

- 最多 10 个相关文件
- 单文件最多 64 KiB
- 上下文总量最多 200 KiB
- diff 单独限制为 100 KiB
- 超限时按相关性裁剪，不静默假装已审查完整仓库

#### 暂不采纳

- 默认上传整个仓库
- 默认上传完整 lockfile、构建产物、压缩文件或二进制文件
- 一开始就构建完整组件树、路由图和全仓依赖图
- 默认上传完整 Git 历史

组件树、路由和历史记录应在评测证明有价值后按需加入，而不是成为每次审查的固定成本。

#### 强制排除

- `.env`、`.env.*`
- `*.pem`、`*.key`、证书和私钥
- 已识别的 token、密码和连接串
- `node_modules`、`dist`、coverage、缓存和生成目录
- 超出仓库根目录的路径

### 5.2 静态分析：近期采纳

#### 第一阶段采纳

CLI 提供显式开关，在本地运行：

- TypeScript `tsc --noEmit`
- ESLint JSON 输出

结果标准化为 `StaticFinding`，至少包含：

```ts
interface StaticFinding {
  source: 'typescript' | 'eslint';
  ruleId?: string;
  severity: 'error' | 'warning' | 'info';
  filePath: string;
  line?: number;
  column?: number;
  message: string;
  toolVersion: string;
}
```

AI 只能解释、合并和补充这些结果，不能修改工具给出的事实来源。

#### 后续按需采纳

- AST 圈复杂度、嵌套深度和重复代码检测
- Bundle 体积回归
- Lighthouse CI
- axe-core 可访问性结果

这些工具依赖构建环境、浏览器或项目配置，应在 CI/Bot 阶段按项目启用，不作为 CLI MVP 的强制依赖。

#### 明确禁止

- 服务端直接执行仓库中的任意 `package.json` script
- 未经用户信任确认加载任意 ESLint 插件或 JavaScript 配置
- 在没有超时、资源限制和隔离的环境中运行用户代码
- 把工具输出冒充为 AI 独立发现

### 5.3 团队规范与 RAG：规则优先，RAG 后置

#### P2 先做

优先支持仓库内版本化规则，例如：

```text
.codereview/
├── rules.md
└── config.json
```

规则应具备 ID、版本、适用路径和严重级别。模型引用规则时必须返回 citation，不能只说“违反团队规范”。

#### 满足以下条件后再做向量 RAG

- 已有 Team / Membership / Role 权限模型
- 知识源有 owner、版本、作用域和删除流程
- 检索前执行租户和仓库授权过滤
- 有固定评测集证明简单关键词/元数据检索不够
- embedding 与模型供应商的数据保留策略可接受
- 检索结果能够返回可验证引用

#### 明确禁止

- 跨团队共享向量 namespace
- 只在检索后做权限过滤
- 把检索文档当作高于 system prompt 的可信指令
- 将用户反馈原样自动加入 few-shot 或知识库

### 5.4 多 Agent：暂缓

多 Agent 只有在以下证据成立后才进入试验：

- 单 Agent 已有 precision、误报率、延迟和 token 成本基线
- 反馈能定位到具体 issue
- 某一专长在离线评测中确实长期漏检
- 系统已具备异步任务、取消、超时、并发和成本预算
- 聚合器可以保留来源、去重并处理冲突

首次试验最多采用：

```text
Architecture/Security 专项 Agent ─┐
                                  ├─ 确定性聚合器 → 最终报告
General Review Agent ─────────────┘
```

不采用开放式 Agent loop，也不允许子 Agent 自行获取 Shell、Git 或网络工具。

### 5.5 Auto-Fix：只采纳受控候选 Patch

#### 可以采纳

- Level 1：输出建议代码块
- Level 2：生成机器可读候选 patch
- CLI 显示 patch 和风险说明
- 用户确认后执行本地 `git apply --check`
- 用户选择是否运行 lint、typecheck 和测试

候选 patch 必须绑定：

- review ID
- base commit/blob SHA
- 允许修改的文件列表
- 生成模型与 Prompt 版本
- 置信度和解释

#### 默认禁止

- 服务端直接修改用户仓库
- 未经确认自动 `git apply`
- 自动 commit、push、合并或强推
- 默认修改 `.env`、密钥、CI 工作流或依赖清单
- patch 路径逃逸仓库根目录
- 在 dirty tree 或 base SHA 不一致时强行应用

未来即使支持 Bot 自动创建修复 PR，也必须使用最小权限、独立分支、明确审计和人工合并。

### 5.6 反馈闭环：近期采纳

Review 级反馈与 ReviewRun 业务链路已经完成：反馈支持 JWT、所有权校验、幂等创建/更新、读取和删除；每次逻辑模型调用都会记录可观测数据。

#### P0 已完成能力

- JWT 保护的反馈创建、更新、读取和删除 API
- CLI `review feedback <review-id> --up|--down [--comment ...]`
- CLI 查看和 `--clear` 幂等清除
- Review 所有权校验
- 每次逻辑模型调用写入 ReviewRun
- 记录 model、provider、Prompt 版本、token、延迟、解析状态和错误

#### 后续增强

review 级 UP/DOWN 只能说明整体感受，后续需要 issue 级动作：

- accurate：判断准确
- false_positive：误报
- accepted：建议被采纳
- rejected：建议被拒绝
- comment：开发者解释

#### 反馈使用边界

反馈先进入离线评测和人工审核，再用于调整 Prompt、规则或 few-shot。禁止：

- 直接把评论拼入 system prompt
- 根据单次反馈立即在线改变规则
- 未经脱敏将反馈用于训练或共享

### 5.7 交互形态：分阶段扩展

#### CLI：继续作为主入口

优先补充：

- context 收集
- static analysis 开关
- `--json`
- CI 阈值与退出码
- feedback
- patch 预览与确认

CLI 最接近工作树，是上下文读取和安全应用 patch 的最佳位置。

#### PR Bot：P2

前置条件：

- 异步 Review Job
- commit SHA 绑定
- webhook 签名和防重放
- delivery/review 幂等键
- 取消和重跑
- GitHub/GitLab App 最小权限
- fork PR 密钥隔离
- 更新同一条评论而不是重复刷屏

#### Web：P2

Web 负责：

- 历史和报告
- 反馈
- 团队规则管理
- 质量趋势、成本和审计

Web 不负责读取本地仓库，也不单独实现一套审查引擎。

#### IDE：P3

IDE 插件应复用稳定的 API、Context Envelope 和 Patch 协议。需要额外处理 workspace trust、未保存文件、权限和编辑器版本兼容，因此不在当前阶段优先开发。

## 6. 目标数据流与信任边界

```text
本地可信边界
┌────────────────────────────────────────────┐
│ CLI / CI / IDE                             │
│ - git diff                                 │
│ - 上下文最小化与 secret 过滤               │
│ - tsc / ESLint（显式启用）                 │
│ - patch 预览、apply/check、测试             │
└───────────────────┬────────────────────────┘
                    │ 版本化请求 + 上传清单
                    ▼
服务端可信边界
┌────────────────────────────────────────────┐
│ Auth / Review Job / Rate Limit             │
│ - 权限与租户过滤                           │
│ - 请求大小和 Schema 校验                   │
│ - ReviewRun / Feedback / 审计              │
│ - Prompt 组装和 ResultParser               │
└───────────────────┬────────────────────────┘
                    │ 最小必要上下文
                    ▼
外部不可信边界
┌────────────────────────────────────────────┐
│ 模型供应商 / 网关                          │
│ - 不获得 Shell、Git、数据库或网络工具       │
│ - 输出始终作为不可信数据校验               │
└────────────────────────────────────────────┘
```

代码 diff、仓库文档、团队规则、静态工具输出和模型响应都必须分别标记来源。除 system policy 外，其余内容均不得改变模型角色、工具权限或输出协议。

## 7. 建议的版本化契约

### 7.1 ReviewContextEnvelope

```ts
interface ReviewContextEnvelopeV1 {
  version: '1';
  baseSha?: string;
  headSha?: string;
  files: Array<{
    path: string;
    kind: 'changed_file' | 'dependency' | 'config';
    content: string;
    sha256: string;
    truncated: boolean;
  }>;
  staticFindings: StaticFinding[];
  omitted: Array<{
    path: string;
    reason: 'denied' | 'binary' | 'generated' | 'too_large' | 'budget';
  }>;
}
```

契约只表示传输结构，不代表所有字段必须在第一版实现。任何新增字段应保持向后兼容，破坏性修改必须提升 `version`。

### 7.2 Review Issue 扩展方向

未来 issue 可增加：

```ts
interface ReviewIssueEvidence {
  source: 'ai' | 'typescript' | 'eslint' | 'team_rule';
  ruleId?: string;
  confidence?: number;
  citations?: Array<{
    path: string;
    lineRange?: string;
    contentHash?: string;
  }>;
}
```

不要把 provenance 只写进自然语言 `why`，否则无法统计误报来源。

## 8. P0–P3 实施计划

### P0：可追踪、可反馈、安全基线

任务：

1. [x] 将真实模型调用写入 ReviewRun。
2. [x] 为 Prompt 增加显式版本并记录 model/provider/token/latency/parse status。
3. [x] 实现 ReviewFeedback API 和 CLI 命令。
4. [ ] 增加 diff 大小限制、敏感文件 denylist 和 secret 扫描。
5. [ ] 明确 diff、模型原始响应和反馈的保留/删除策略。
6. [ ] 建立固定审查样本集和回归指标。

退出标准：

- 每次审查可追溯到模型、Prompt 和调用成本。
- 用户可以提交、修改和删除反馈。
- 已有 precision、误报率、p95 延迟和单次 token 成本基线。
- 用户能知道哪些文件或片段将被发送到外部模型。

### P1：上下文增强与静态分析

任务：

1. 定义并实现 `ReviewContextEnvelopeV1`。
2. CLI 收集相关文件、符号和关键配置，执行预算与 denylist。
3. 可选运行 TypeScript 和 ESLint，标准化 findings。
4. Prompt 增加独立的 untrusted context/static sections。
5. 结果增加来源、规则 ID、引用和置信度。
6. CLI 增加 `--json`、超时和 CI 退出策略。

退出标准：

- 固定数据集上的 coupling/consistency 误报率低于 diff-only 基线。
- 静态问题保留原工具 provenance，AI 不重复伪造。
- token、延迟和上传代码量未超过预算。

### P2：团队规则、PR Bot、Web 与候选 Patch

任务：

1. 增加 Team/Membership/Role 和 RuleSet/RuleVersion。
2. 先实现关键词/元数据规则检索和强制 citation。
3. 引入异步任务和 GitHub/GitLab App Bot。
4. Web 提供历史、反馈、规则、趋势和审计。
5. 实现候选 patch 协议、CLI 预览、确认与本地验证。

退出标准：

- 租户隔离和越权测试通过。
- Bot 按 commit SHA 幂等更新，无重复评论和陈旧结果。
- 每条团队规则命中都有可访问引用。
- 候选 patch 的可应用率、验证通过率和拒绝率可统计。

### P3：证据驱动的高级能力

任务：

1. 评估向量 RAG 是否显著优于简单检索。
2. 只对一个高价值专项试验双 Agent。
3. IDE 插件复用稳定契约。
4. 在低风险、强验证、显式授权场景探索自动创建修复分支或 PR。

退出标准：

- RAG 或多 Agent 在质量提升、延迟和费用之间达到预设门槛。
- 任一高级能力均可按配置回退到单 Agent 基线。
- 自动化没有绕过人工确认和权限边界。

## 9. 明确不做清单

以下能力不应作为默认行为实现：

1. 默认上传整个仓库或完整 Git 历史。
2. 上传 `.env`、私钥、证书、token 或已识别 secret。
3. 服务端执行仓库中的任意 script、插件、构建或测试。
4. 允许模型直接调用 Shell、Git、数据库或任意网络工具。
5. 未经用户确认自动应用 patch、commit、push 或合并。
6. 在 base SHA 不一致时强行应用模型 patch。
7. 将用户反馈直接加入线上 Prompt、few-shot 或训练数据。
8. 在没有租户隔离时实现团队 RAG。
9. 在没有单 Agent 基线时通过增加 Agent 数量掩盖质量问题。
10. 让 CLI、Bot、Web 和 IDE 分别维护不同的审查规则与结果 Schema。

## 10. 评测指标

### 质量

- issue precision
- false positive rate
- 同根因重复 issue 比例
- 阻断级问题漏检率
- 建议采纳率
- 用户 UP/DOWN 比例

### 成本与性能

- p50 / p95 审查延迟
- input/output token
- 单次审查费用
- 上下文上传字节数
- 静态分析耗时
- 多 Agent 相对单 Agent 的增量成本

### 安全与稳定性

- secret 拦截数量
- 越权访问测试通过率
- Prompt injection 回归通过率
- stale SHA / patch apply 失败率
- Bot webhook 重放和重复评论数量
- FAILED Review 是否存在无法追踪的运行记录

任何新能力必须先定义成功指标和回滚条件，再进入默认开启状态。

## 11. 与现有文档的关系

| 文档 | 事实范围 |
|------|----------|
| [architecture.md](./architecture.md) | 当前系统边界、模块职责和总体技术架构 |
| [agent-design.md](./agent-design.md) | Agent 内部职责、模型调用、解析与未来编排设计 |
| [prompt-design.md](./prompt-design.md) | Prompt 文件、评分规则、输出协议和 few-shot 维护 |
| [api-design.md](./api-design.md) | HTTP API、认证、错误码和未来异步接口 |
| [database-design.md](./database-design.md) | 数据模型设计；实际数据库事实以 Prisma Schema 为准 |
| 本文 | 增强能力的采纳决策、顺序、安全边界与退出标准 |

当本文中的某项进入开发状态时，应同步更新对应设计文档；未开发能力必须继续标记为“规划”，不能提前写成现状。

## 12. 推荐的下一项开发任务

ReviewRun 与 review 级 Feedback 闭环已经完成。下一步继续完成 **P0 安全输入基线**，而不是立即上多 Agent 或 RAG：

1. 对 diff 增加明确的 UTF-8 字节上限。
2. 在 CLI 上传前排除 `.env`、私钥、证书和生成目录。
3. 增加常见密钥、token 和连接串扫描，命中时默认阻止上传。
4. 输出本次将发送的文件清单、排除原因和裁剪说明。
5. 明确 diff、模型响应和反馈的保留与删除策略。
6. 建立第一批固定审查样本和人工标注。

完成安全输入基线后，再实施 `ReviewContextEnvelopeV1` 和 TypeScript/ESLint 结果接入。这样可以在不扩大敏感代码暴露面的前提下，用真实反馈和 ReviewRun 数据判断上下文增强是否降低误报。
