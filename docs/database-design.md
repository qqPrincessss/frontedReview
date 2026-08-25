# 数据库设计文档

## 概述

- 数据库：PostgreSQL 14+
- ORM：Prisma
- 主键策略：UUID v4
- 时间字段：UTC 时间戳

---

## ER 关系图

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│   users     │ 1     * │    reviews       │ 1     * │   review_issues     │
│             │────────>│                  │────────>│                     │
│ id (PK)     │         │ id (PK)          │         │ id (PK)             │
│ username    │         │ user_id (FK)     │         │ review_id (FK)      │
│ email       │         │ diff_content     │         │ file_path           │
│ password    │         │ language         │         │ line_range          │
│ created_at  │         │ branch_from      │         │ severity            │
│ updated_at  │         │ branch_to        │         │ dimension           │
│             │         │ summary          │         │ what                │
│             │         │ overall_score    │         │ why                 │
│             │         │ dimension_scores │         │ suggestion          │
│             │         │ highlights       │         │                     │
│             │         │ status           │         │                     │
│             │         │ created_at       │         │                     │
└─────────────┘         └──────────────────┘         └─────────────────────┘
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  username     String   @unique @db.VarChar(50)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  reviews Review[]

  @@map("users")
}

enum ReviewStatus {
  PENDING
  COMPLETED
  FAILED

  @@map("review_status")
}

model Review {
  id              String       @id @default(uuid())
  userId          String       @map("user_id")
  diffContent     String       @map("diff_content") @db.Text
  language        String?      @db.VarChar(20)
  branchFrom      String?      @map("branch_from") @db.VarChar(100)
  branchTo        String?      @map("branch_to") @db.VarChar(100)
  summary         String?      @db.Text
  overallScore    Int?         @map("overall_score")
  dimensionScores Json?        @map("dimension_scores") @db.JsonB
  highlights      Json?        @db.JsonB
  status          ReviewStatus @default(PENDING)
  createdAt       DateTime     @default(now()) @map("created_at")

  user   User          @relation(fields: [userId], references: [id])
  issues ReviewIssue[]

  @@index([userId])
  @@index([createdAt])
  @@map("reviews")
}

enum Severity {
  ERROR
  WARNING
  INFO

  @@map("severity")
}

model ReviewIssue {
  id         String   @id @default(uuid())
  reviewId   String   @map("review_id")
  filePath   String   @map("file_path") @db.VarChar(500)
  lineRange  String?  @map("line_range") @db.VarChar(20)
  severity   Severity
  dimension  String   @db.VarChar(20)
  what       String   @db.Text
  why        String   @db.Text
  suggestion String   @db.Text

  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  @@index([reviewId])
  @@index([severity])
  @@map("review_issues")
}
```

---

## 索引策略

| 表 | 索引 | 用途 |
|----|------|------|
| users | username (unique) | 登录查询 |
| users | email (unique) | 注册去重 |
| reviews | user_id | 查询用户的审查历史 |
| reviews | created_at | 按时间排序 |
| review_issues | review_id | 查询某次审查的所有问题 |
| review_issues | severity | 按严重程度过滤 |

---

## 数据量预估

假设一个中小团队（10 人）使用：

| 表 | 日均增量 | 月增量 | 单条大小 |
|----|---------|--------|---------|
| users | - | ~10 | 小 |
| reviews | ~20 条 | ~600 条 | 中（diff 可能较大） |
| review_issues | ~80 条 | ~2400 条 | 小 |

**注意：** `diff_content` 字段可能较大（几十 KB），后续如果数据量大可考虑压缩存储或独立到对象存储。

---

## Migration 策略

使用 Prisma Migrate 管理数据库版本：

```bash
# 开发环境：创建并应用 migration
npx prisma migrate dev --name init

# 生产环境：只应用 migration
npx prisma migrate deploy

# 重置数据库（开发用）
npx prisma migrate reset
```
