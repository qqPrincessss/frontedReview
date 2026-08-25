# 输出格式

请严格按照以下 JSON 格式输出审查结果，不要包含其他内容：

```json
{
  "summary": "一句话总结本次审查的核心发现",
  "overall_score": 62,
  "dimension_scores": {
    "srp": { "score": 5, "note": "问题说明，如果没问题则为空字符串" },
    "abstraction": { "score": 7, "note": "" },
    "naming": { "score": 6, "note": "具体问题" },
    "dry": { "score": 8, "note": "" },
    "coupling": { "score": 6, "note": "具体问题" },
    "readability": { "score": 5, "note": "具体问题" },
    "consistency": { "score": 8, "note": "" }
  },
  "issues": [
    {
      "file_path": "src/components/Example.tsx",
      "line_range": "10-45",
      "severity": "error",
      "dimension": "srp",
      "what": "描述问题是什么",
      "why": "解释为什么这是个问题",
      "suggestion": "给出具体的改进建议"
    }
  ],
  "highlights": [
    "代码中做得好的地方"
  ]
}
```

## 字段说明

- `summary`: 一句话总结，不超过 50 字
- `overall_score`: 0-100 的综合分数
- `dimension_scores`: 7 个维度各自的评分和说明
- `issues`: 发现的问题列表
  - `severity`: 严重程度 - "error"(必须修复) / "warning"(建议修复) / "info"(可以改进)
  - `dimension`: 该问题所属的维度标识
- `highlights`: 代码中的亮点（正向反馈）

## 注意

- 只输出 JSON，不要加额外解释
- 如果某个维度没有问题，note 留空字符串
- issues 数量不限，但每个问题都要有价值，不要凑数
- 如果代码质量很好，issues 可以为空数组
