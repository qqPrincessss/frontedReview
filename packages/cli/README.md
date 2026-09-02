# @codereview-ai/cli

AI 驱动的前端代码审查命令行工具。CLI 在本地采集 Git diff，调用 CodeReview AI 服务，并在终端展示评分、问题和建议。

## 环境要求

- Node.js 18 或更高版本
- Git
- 一个可访问的 CodeReview AI 服务端

## 安装

```bash
npm install --global @codereview-ai/cli
```

安装后使用：

```bash
review --help
```

也可以不全局安装：

```bash
npx @codereview-ai/cli --help
```

## 配置服务端

本地开发默认访问：

```text
http://localhost:3000/api
```

连接已部署的服务时，在首次注册或登录时指定 API 地址。地址必须包含 `/api` 前缀：

```bash
review register \
  --server https://review.example.com/api \
  -u yourname \
  -e you@example.com \
  -p your-password

review login \
  --server https://review.example.com/api \
  -u yourname \
  -p your-password
```

地址会保存到：

- Windows：`%USERPROFILE%\.codereview\config.json`
- macOS/Linux：`~/.codereview/config.json`

也可以用环境变量临时覆盖保存的地址：

```bash
CODEREVIEW_API_URL=https://review.example.com/api review history
```

Windows CMD：

```cmd
set CODEREVIEW_API_URL=https://review.example.com/api
review history
```

## 提交审查

在需要审查的 Git 仓库中执行：

```bash
review submit --base HEAD
```

指定分支范围：

```bash
review submit --base main --head feature/my-change
```

查看历史、详情和提交反馈：

```bash
review history
review show <review-id>
review feedback <review-id> --up --comment "建议准确"
review feedback <review-id> --down --comment "存在误报"
review feedback <review-id>
review feedback <review-id> --clear
```

## 安全说明

- CLI 会将当前 Git diff 发送到配置的服务端，并由服务端调用模型供应商。
- 提交前请确认 diff 中不包含密钥、密码或其他敏感信息。
- 通过 `-p` 传入的密码可能保留在 Shell 历史中；生产版本应进一步支持隐藏式交互输入。
- 登录 token 保存在用户主目录的 `.codereview/config.json` 中，请勿共享该文件。

## 服务端

npm 包只包含 CLI，不包含 NestJS 服务端。若没有官方托管地址，需要先部署本项目的 `packages/server`，再通过 `--server` 或 `CODEREVIEW_API_URL` 指向它。
