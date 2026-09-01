# 输出格式协议

输出必须是可由 `JSON.parse` 直接解析的单个 JSON 对象，且包含以下全部字段：

```json
{
  "summary": "只针对当前 diff 的总体结论",
  "overall_score": 80,
  "dimension_scores": {
    "srp": { "score": 8, "note": "评分依据" },
    "abstraction": { "score": 8, "note": "评分依据" },
    "naming": { "score": 8, "note": "评分依据" },
    "dry": { "score": 8, "note": "评分依据" },
    "coupling": { "score": 8, "note": "评分依据" },
    "readability": { "score": 8, "note": "评分依据" },
    "consistency": { "score": 8, "note": "评分依据" }
  },
  "issues": [
    {
      "file_path": "src/example.ts",
      "line_range": "10-20",
      "severity": "warning",
      "dimension": "srp",
      "what": "问题描述",
      "why": "影响说明",
      "suggestion": "可执行的修改建议"
    }
  ],
  "highlights": ["值得保留的具体实践"]
}
```

## 字段约束

- `summary`：非空字符串，只总结当前 diff。
- `overall_score`：0 到 100 的整数，必须按 system prompt 中的权重公式计算。
- `dimension_scores`：必须且只能包含七个固定维度；每项的 `score` 是 1 到 10 的整数，`note` 是非空且有证据的字符串。
- `issues`：数组；没有问题时返回 `[]`，不得返回 `null`。
- `highlights`：非空字符串数组；没有亮点时返回 `[]`，不得返回 `null`。

## Issue 约束

每个 issue 必须包含且只能包含：

- `file_path`：diff 中真实存在的文件路径。
- `line_range`：使用 `"N"` 或 `"N-M"`；无法可靠确定时返回空字符串，不得伪造。
- `severity`：只能是 `error`、`warning` 或 `info`。
- `dimension`：只能是 `srp`、`abstraction`、`naming`、`dry`、`coupling`、`readability` 或 `consistency`。
- `what`：具体问题。
- `why`：实际影响。
- `suggestion`：能够直接执行的修改建议。

Severity 定义：

- `error`：很可能导致正确性、安全、数据损坏、构建或运行失败，合并前必须修复。
- `warning`：存在明确的设计、维护或扩展风险，建议修复。
- `info`：非阻塞但有价值的改进。

## JSON 限制

- 不要输出 Markdown 代码围栏。
- 不要输出注释、尾随逗号、`NaN` 或 JSON 之外的文字。
- 所有必填字段都必须存在。
