# API 接口设计文档

## 基础信息

- Base URL: `http://localhost:3000/api`
- 认证方式: Bearer Token (JWT)
- 请求格式: JSON
- 响应格式: JSON

## 统一响应结构

### 成功响应

```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "success"
}
```

### 错误响应

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "具体错误信息"
}
```

---

## 1. 认证模块

### POST /api/auth/register

注册新用户。

**请求体：**

```json
{
  "username": "cyan",
  "email": "cyan@example.com",
  "password": "mypassword123"
}
```

**校验规则：**
- username: 必填，3-20 字符，仅字母数字下划线
- email: 必填，合法邮箱格式
- password: 必填，6-32 字符

**成功响应 (201)：**

```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "username": "cyan",
    "email": "cyan@example.com",
    "created_at": "2026-08-20T10:00:00Z"
  },
  "message": "注册成功"
}
```

**错误响应：**
- 409: 用户名或邮箱已存在

---

### POST /api/auth/login

用户登录，返回 JWT。

**请求体：**

```json
{
  "username": "cyan",
  "password": "mypassword123"
}
```

**成功响应 (200)：**

```json
{
  "statusCode": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400,
    "user": {
      "id": "uuid",
      "username": "cyan"
    }
  },
  "message": "登录成功"
}
```

**错误响应：**
- 401: 用户名或密码错误

---

### GET /api/auth/profile

获取当前用户信息。

**请求头：**

```
Authorization: Bearer <token>
```

**成功响应 (200)：**

```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "username": "cyan",
    "email": "cyan@example.com",
    "created_at": "2026-08-20T10:00:00Z",
    "review_count": 15
  }
}
```

---

## 2. 审查模块

### POST /api/reviews

提交代码进行 AI 审查。

**请求头：**

```
Authorization: Bearer <token>
```

**请求体：**

```json
{
  "diff": "diff --git a/src/components/UserList.tsx b/src/components/UserList.tsx\nindex abc..def 100644\n--- a/src/components/UserList.tsx\n+++ b/src/components/UserList.tsx\n@@ -1,5 +1,50 @@\n+import { useState, useEffect } from 'react';\n+...",
  "language": "typescript",
  "branch_from": "main",
  "branch_to": "feature/user-list"
}
```

**字段说明：**
- diff: 必填，git diff 输出的完整内容
- language: 可选，不传则自动推断
- branch_from: 可选，源分支名
- branch_to: 可选，目标分支名

**成功响应 (201)：**

```json
{
  "statusCode": 201,
  "data": {
    "id": "review-uuid",
    "summary": "组件职责过载，存在多处命名不清晰问题，建议拆分并重命名",
    "overall_score": 58,
    "dimension_scores": {
      "srp": { "score": 4, "note": "UserList 组件同时做了数据获取、过滤和渲染" },
      "abstraction": { "score": 6, "note": "部分混合了业务逻辑和 UI 逻辑" },
      "naming": { "score": 5, "note": "data, handleClick2 等命名不清晰" },
      "dry": { "score": 7, "note": "" },
      "coupling": { "score": 6, "note": "直接依赖全局 store 内部结构" },
      "readability": { "score": 5, "note": "嵌套 4 层 if-else" },
      "consistency": { "score": 8, "note": "" }
    },
    "issues": [
      {
        "id": "issue-uuid",
        "file_path": "src/components/UserList.tsx",
        "line_range": "10-45",
        "severity": "error",
        "dimension": "srp",
        "what": "UserList 组件同时负责数据获取、筛选逻辑、列表渲染",
        "why": "任何需求变更都要修改这个大组件，容易引入回归 bug",
        "suggestion": "拆分为 useUserList hook（数据）+ UserFilter（筛选）+ UserItem（列表项）"
      },
      {
        "id": "issue-uuid-2",
        "file_path": "src/components/UserList.tsx",
        "line_range": "23",
        "severity": "warning",
        "dimension": "naming",
        "what": "变量名 data 无法表达含义",
        "why": "团队其他成员读代码时不知道 data 里存的是什么",
        "suggestion": "改为 userList 或 filteredUsers"
      }
    ],
    "highlights": [
      "TypeScript 类型使用规范",
      "错误边界处理得当"
    ],
    "created_at": "2026-08-20T10:00:00Z"
  }
}
```

**错误响应：**
- 400: diff 内容为空或格式异常
- 500: AI 服务调用失败

---

### GET /api/reviews

获取当前用户的审查历史列表。

**请求头：**

```
Authorization: Bearer <token>
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| limit | int | 10 | 每页数量（最大 50） |
| sort | string | created_at:desc | 排序 |

**成功响应 (200)：**

```json
{
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "review-uuid",
        "summary": "组件职责过载...",
        "overall_score": 58,
        "language": "typescript",
        "branch_from": "main",
        "branch_to": "feature/user-list",
        "issue_count": 5,
        "status": "completed",
        "created_at": "2026-08-20T10:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET /api/reviews/:id

获取某次审查的完整报告。

**成功响应 (200)：**

同 `POST /api/reviews` 的响应格式，增加 `diff_content` 字段。

---

### GET /api/reviews/:id/pdf

下载审查报告的 PDF 文件。

**响应头：**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="review-report-{id}.pdf"
```

---

## 3. 错误码汇总

| HTTP 状态码 | 含义 | 场景 |
|------------|------|------|
| 400 | 参数错误 | 校验失败、diff 为空 |
| 401 | 未认证 | token 缺失或过期 |
| 403 | 无权限 | 访问他人的审查记录 |
| 404 | 不存在 | review_id 无效 |
| 409 | 冲突 | 注册时用户名重复 |
| 500 | 服务错误 | AI 调用失败、数据库异常 |
