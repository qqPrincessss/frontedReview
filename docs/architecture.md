# CodeReview AI - 架构设计文档

## 1. 项目概述

### 1.1 定位

一个基于 AI 的前端代码审查工具，专注于识别"屎山代码"——即可维护性差、职责混乱、抽象不当的代码问题。

### 1.2 与 ESLint 的差异化

| ESLint | CodeReview AI |
|--------|---------------|
| 规则引擎，静态匹配 | AI 理解意图，智能判断 |
| 管格式、语法、简单规范 | 管架构、职责、可维护性 |
| 能用正则描述的问题 | 需要"理解代码"才能判断的问题 |
| 输出：pass / fail | 输出：评分 + 分析报告 + 改进建议 |

### 1.3 核心痛点

AI 时代，开发者大量使用 AI 生成代码，但生成的代码往往：
- 职责堆砌在一个函数/组件里
- 命名随意、抽象层级混乱
- 能跑但不可维护

本工具解决的问题：**在代码合入前，自动识别这些"能跑但会腐烂"的代码。**

---

## 2. 系统架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         客户端层                                   │
│                                                                  │
│   ┌─────────────────┐              ┌─────────────────────────┐   │
│   │    CLI 工具      │              │     Web 前端             │   │
│   │                 │              │                         │   │
│   │  - git diff 采集 │              │  - 审查历史列表          │   │
│   │  - 提交审查      │              │  - 报告详情渲染          │   │
│   │  - 终端查看结果  │              │  - PDF 导出             │   │
│   └────────┬────────┘              └────────────┬────────────┘   │
│            │                                    │                │
└────────────│────────────────────────────────────│────────────────┘
             │ HTTP                               │ HTTP
             ▼                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                  NestJS 后端服务 (:3000)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API 层                                                     │  │
│  │  路由 → 守卫(JWT) → 管道(校验) → 控制器 → 服务 → 响应       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────────────────┐ │
│  │  Auth 模块    │ │  Review 模块    │ │  Report 模块           │ │
│  │              │ │                │ │                        │ │
│  │  - 注册      │ │  - 接收 diff    │ │  - 查询历史            │ │
│  │  - 登录      │ │  - 调度 Agent   │ │  - 报告详情            │ │
│  │  - JWT 签发  │ │  - 存储结果     │ │  - 生成 PDF            │ │
│  └──────────────┘ └────────────────┘ └────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Agent 层（核心引擎）→ 详见 agent-design.md                  │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │ AgentService │  │ ClaudeClient │  │ PromptBuilder  │   │  │
│  │  │ (对外接口)    │  │ (SDK 封装)    │  │ (组装 prompt)  │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘   │  │
│  │         │                 │                   │            │  │
│  │         └─────────────────┼───────────────────┘            │  │
│  │                           │                                │  │
│  │                    ┌──────┴───────┐                        │  │
│  │                    │ ResultParser │                        │  │
│  │                    │ (结果解析)    │                        │  │
│  │                    └──────────────┘                        │  │
│  │                                                            │  │
│  │  技术栈:                                                    │  │
│  │  - @anthropic-ai/claude-agent-sdk (Claude AI 通信)         │  │
│  │  - Prompt 模板 (system + format + few-shot 校准)           │  │
│  │  - 错误处理 (超时重试 + 结果容错 + 降级策略)                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  数据层                                                     │  │
│  │                                                            │  │
│  │  - Prisma ORM                                              │  │
│  │  - PostgreSQL                                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       PostgreSQL                                   │
│                                                                  │
│  users │ reviews │ review_issues                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层 | 技术 | 版本要求 | 选型理由 |
|----|------|---------|---------|
| 后端框架 | NestJS | 10+ | 模块化、DI、装饰器、TypeScript 原生 |
| 运行时 | Node.js | 18+ | Claude Agent SDK 要求 |
| 数据库 | PostgreSQL | 14+ | 可靠、JSON 支持好、适合生产 |
| ORM | Prisma | 5+ | 类型安全、migration 好用、生态好 |
| 认证 | JWT | - | 无状态，CLI 和 Web 都友好 |
| AI 引擎 | Claude Agent SDK | 0.3+ | 官方 SDK，agent loop 内置 |
| CLI 框架 | commander.js | 12+ | 轻量、标准、生态成熟 |
| PDF 生成 | pdfkit / puppeteer | - | 报告导出 |
| 语言 | TypeScript | 5.0+ | 全栈统一，类型安全 |

### 2.3 Monorepo 结构

```
AgentCall/
├── packages/
│   ├── server/                  ← NestJS 后端
│   │   ├── src/
│   │   │   ├── main.ts                 应用入口
│   │   │   ├── app.module.ts           根模块
│   │   │   ├── common/                 公共（守卫、过滤器、管道）
│   │   │   │   ├── guards/
│   │   │   │   │   └── jwt-auth.guard.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   └── pipes/
│   │   │   │       └── validation.pipe.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/               认证模块
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── dto/
│   │   │   │   │   └── strategies/
│   │   │   │   ├── review/             审查模块
│   │   │   │   │   ├── review.module.ts
│   │   │   │   │   ├── review.controller.ts
│   │   │   │   │   ├── review.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   └── report/             报告模块
│   │   │   │       ├── report.module.ts
│   │   │   │       ├── report.controller.ts
│   │   │   │       ├── report.service.ts
│   │   │   │       └── dto/
│   │   │   ├── agent/                  AI Agent 封装
│   │   │   │   ├── agent.module.ts
│   │   │   │   ├── agent.service.ts
│   │   │   │   └── prompts/            Prompt 模板
│   │   │   │       ├── system.md
│   │   │   │       ├── output-format.md
│   │   │   │       └── examples/
│   │   │   └── database/               数据库
│   │   │       └── prisma.service.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma           数据模型
│   │   │   └── migrations/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── cli/                     ← CLI 工具
│   │   ├── src/
│   │   │   ├── index.ts                入口
│   │   │   ├── commands/
│   │   │   │   ├── login.ts            登录
│   │   │   │   ├── review.ts           提交审查
│   │   │   │   └── history.ts          查看历史
│   │   │   └── utils/
│   │   │       ├── git.ts              git diff 采集
│   │   │       ├── api.ts              HTTP 请求封装
│   │   │       └── config.ts           本地配置（token 存储）
│   │   ├── bin/
│   │   │   └── review.ts              可执行入口
│   │   └── package.json
│   │
│   └── web/                     ← Web 前端（Phase 3）
│       └── ...
│
├── docs/                        ← 项目文档
│   ├── architecture.md          总体架构
│   ├── agent-design.md          Agent 服务设计（核心引擎）
│   ├── api-design.md            API 接口设计
│   ├── database-design.md       数据库设计
│   └── prompt-design.md         Prompt 工程设计
├── package.json                 ← workspace 根配置
├── tsconfig.base.json
└── .gitignore
```

---

## 3. 数据模型

### 3.1 ER 关系

```
users 1 ──── * reviews 1 ──── * review_issues
```

### 3.2 表结构

#### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | VARCHAR(50) | 用户名，唯一 |
| email | VARCHAR(255) | 邮箱，唯一 |
| password_hash | VARCHAR(255) | bcrypt 哈希后的密码 |
| created_at | TIMESTAMP | 注册时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### reviews（审查记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 外键 → users.id |
| diff_content | TEXT | 提交的 git diff 原文 |
| language | VARCHAR(20) | 主要语言（ts/js/vue/jsx） |
| branch_from | VARCHAR(100) | 对比起点分支 |
| branch_to | VARCHAR(100) | 对比目标分支 |
| summary | TEXT | AI 生成的一句话总结 |
| overall_score | INTEGER | 综合评分 0-100 |
| dimension_scores | JSONB | 各维度评分 JSON |
| highlights | JSONB | 正向反馈列表 |
| status | ENUM | pending / completed / failed |
| created_at | TIMESTAMP | 创建时间 |

#### review_issues（审查问题表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| review_id | UUID | 外键 → reviews.id |
| file_path | VARCHAR(500) | 涉及的文件路径 |
| line_range | VARCHAR(20) | 行号范围（如 "42-68"） |
| severity | ENUM | error / warning / info |
| dimension | VARCHAR(20) | 所属维度（srp/naming/dry 等） |
| what | TEXT | 问题描述 |
| why | TEXT | 为什么是问题 |
| suggestion | TEXT | 改进建议 |

---

## 4. API 设计

### 4.1 认证相关

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 无 |
| POST | `/api/auth/login` | 用户登录，返回 JWT | 无 |
| GET | `/api/auth/profile` | 获取当前用户信息 | JWT |

### 4.2 审查相关

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/reviews` | 提交 diff 进行审查 | JWT |
| GET | `/api/reviews` | 审查历史列表（分页） | JWT |
| GET | `/api/reviews/:id` | 审查报告详情 | JWT |
| GET | `/api/reviews/:id/pdf` | 下载 PDF 报告 | JWT |

### 4.3 请求/响应示例

#### POST /api/reviews

请求：
```json
{
  "diff": "diff --git a/src/App.tsx ...\n+ export function App() {...}",
  "language": "typescript",
  "branch_from": "main",
  "branch_to": "feature/user-list"
}
```

响应：
```json
{
  "id": "uuid-xxx",
  "summary": "组件职责过载，建议拆分",
  "overall_score": 62,
  "dimension_scores": {
    "srp": { "score": 5, "note": "..." },
    "abstraction": { "score": 7, "note": "" },
    "naming": { "score": 6, "note": "..." },
    "dry": { "score": 7, "note": "" },
    "coupling": { "score": 8, "note": "" },
    "readability": { "score": 5, "note": "..." },
    "consistency": { "score": 8, "note": "" }
  },
  "issues": [...],
  "highlights": [...],
  "created_at": "2026-08-20T10:00:00Z"
}
```

---

## 5. CLI 设计

### 5.1 命令列表

```bash
review login                      # 交互式登录，存储 token
review logout                     # 清除本地 token
review submit                     # 自动采集 git diff，提交审查
review submit --base main         # 指定基准分支
review submit --base main --head feature/xxx  # 指定对比范围
review history                    # 查看最近审查列表
review history --limit 20         # 指定数量
review show <review-id>           # 查看某次报告详情
```

### 5.2 工作流

```
用户在项目目录执行 review submit
    │
    ├── 1. 读取本地 token（~/.codereview/config.json）
    │      没有 → 提示先 review login
    │
    ├── 2. 执行 git diff（默认 HEAD 对比 working tree）
    │      可通过 --base/--head 自定义
    │
    ├── 3. 检测主要语言（从文件扩展名推断）
    │
    ├── 4. POST /api/reviews 提交 diff
    │
    ├── 5. 等待响应（同步，可能 10-20s）
    │      显示 loading 动画
    │
    └── 6. 格式化输出审查报告到终端
           - 彩色显示评分
           - 按 severity 排序问题列表
           - 展示改进建议
```

### 5.3 本地配置

存储位置：`~/.codereview/config.json`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "server": "http://localhost:3000",
  "username": "cyan"
}
```

---

## 6. AI Agent 设计

> 完整设计详见 [agent-design.md](./agent-design.md)

### 6.1 Agent 在系统中的角色

Agent 是本项目的**核心引擎**，所有智能审查能力由它驱动。它不是后端的附属模块，而是一个职责独立的服务层。

```
后端其他模块的职责：接收请求、存储数据、管理用户
Agent 的职责：    接收 diff → 理解代码 → 输出审查报告
```

**边界清晰：** Agent 不碰数据库、不碰 HTTP、不碰认证。它只做一件事：输入 diff 字符串，输出结构化结果。这保证了它可以独立测试、独立替换。

### 6.2 内部组件

| 组件 | 职责 |
|------|------|
| AgentService | 对外唯一接口，编排整个审查流程 |
| PromptBuilder | 加载模板文件，组装完整 prompt |
| ClaudeClient | 封装 Claude Agent SDK，处理流式响应、超时重试 |
| ResultParser | 从 AI 原始输出中提取 JSON，容错和字段校验 |

### 6.3 审查维度

| # | 维度 | 英文标识 | 权重 | 关注点 |
|---|------|---------|------|--------|
| 1 | 职责单一 | srp | 高 | 函数/组件是否只做一件事 |
| 2 | 抽象层级 | abstraction | 高 | 同一函数内操作是否在同一层级 |
| 3 | 命名表意 | naming | 中 | 读名字能否知道用途 |
| 4 | 重复冗余 | dry | 中 | 是否存在 copy-paste |
| 5 | 耦合度 | coupling | 高 | 模块间依赖是否合理 |
| 6 | 可读性 | readability | 中 | 控制流是否清晰 |
| 7 | 一致性 | consistency | 低 | 编码模式是否统一 |

### 6.4 Prompt 组装流程

```
System Prompt (system.md)           → 角色 + 维度定义 + 分数标准 + 审查规则
Output Format (output-format.md)    → JSON 结构规范
Few-shot Examples (examples/*.json) → 32分/62分/88分 三档校准锚点
User Input                          → 实际的 git diff 内容
```

### 6.5 分数校准策略

- 通过 few-shot 示例建立分数锚点（低/中/高三档）
- temperature 设为 0.3，减少随机波动
- 后续可加入用户反馈机制，积累校准数据

### 6.6 错误处理

| 异常 | 策略 |
|------|------|
| Claude 超时 | 重试 2 次，间隔 2s |
| API 限流 (429) | 等待后重试 |
| 返回非 JSON | ResultParser 容错提取 |
| 字段缺失 | 填充默认值，降级返回 |

### 6.7 演进路线

| 版本 | 能力 |
|------|------|
| v1 | 单次同步审查（当前） |
| v2 | 异步审查 + 任务队列 |
| v3 | 多 Agent 协作（架构 Agent + 命名 Agent） |
| v4 | 学习用户偏好，调整审查严格度 |
| v5 | 增量审查（只审本次相对上次的变化） |

---

## 7. 开发计划

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| Phase 1 | NestJS 后端骨架 + Prisma + PostgreSQL + JWT | 最高 |
| Phase 2 | Agent 层：Claude SDK 封装 + prompt 工程 | 最高 |
| Phase 3 | CLI 工具：login + submit + history | 高 |
| Phase 4 | Web 前端：报告渲染 + PDF 导出 | 中 |
| Phase 5 | 优化：异步审查、webhook 集成、团队功能 | 低 |

---

## 8. 环境要求

- Node.js 18+
- PostgreSQL 14+
- Anthropic API Key（Claude Agent SDK）
- Git（CLI 采集 diff）

---

## 9. 未来扩展

- 异步审查：提交后返回 ID，后台处理，WebSocket 推送结果
- GitHub/GitLab Webhook：PR 创建时自动触发审查
- 团队功能：团队级别的代码质量趋势看板
- 自定义规则：用户可以配置自己关注的维度和权重
- 多语言支持：支持 Go、Python、Java 等后端代码审查
