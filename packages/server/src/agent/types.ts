/**
 * Agent 层类型定义
 */

/** 单个维度评分 */
export interface DimensionScore {
  score: number;
  note: string;
}

/** 各维度评分集合 */
export interface DimensionScores {
  srp: DimensionScore;
  abstraction: DimensionScore;
  naming: DimensionScore;
  dry: DimensionScore;
  coupling: DimensionScore;
  readability: DimensionScore;
  consistency: DimensionScore;
}

/** 单个审查问题 */
export interface ReviewIssue {
  file_path: string;
  line_range: string;
  severity: 'error' | 'warning' | 'info';
  dimension: string;
  what: string;
  why: string;
  suggestion: string;
}

/** Agent 审查结果 */
export interface ReviewResult {
  summary: string;
  overall_score: number;
  dimension_scores: DimensionScores;
  issues: ReviewIssue[];
  highlights: string[];
}

/** Agent 配置 */
export interface AgentConfig {
  maxTurns: number;
  allowedTools: string[];
  temperature: number;
  maxTokens: number;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxDiffSize: number;
  maxConcurrent: number;
  promptsDir: string;
}
