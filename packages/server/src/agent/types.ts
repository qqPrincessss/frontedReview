export type ReviewSeverity = 'error' | 'warning' | 'info';

export type ReviewDimension =
  | 'srp'
  | 'abstraction'
  | 'naming'
  | 'dry'
  | 'coupling'
  | 'readability'
  | 'consistency';

export interface DimensionScore {
  score: number;
  note: string;
}

export interface DimensionScores {
  srp: DimensionScore;
  abstraction: DimensionScore;
  naming: DimensionScore;
  dry: DimensionScore;
  coupling: DimensionScore;
  readability: DimensionScore;
  consistency: DimensionScore;
}

export interface ReviewIssue {
  file_path: string;
  line_range: string;
  severity: ReviewSeverity;
  dimension: ReviewDimension;
  what: string;
  why: string;
  suggestion: string;
}

export interface ReviewResult {
  summary: string;
  overall_score: number;
  dimension_scores: DimensionScores;
  issues: ReviewIssue[];
  highlights: string[];
}
