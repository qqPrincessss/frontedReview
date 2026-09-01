import {
  DimensionScores,
  ReviewDimension,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from './types';

export const REVIEW_DIMENSIONS: readonly ReviewDimension[] = [
  'srp',
  'abstraction',
  'naming',
  'dry',
  'coupling',
  'readability',
  'consistency',
];

const REVIEW_SEVERITIES: readonly ReviewSeverity[] = [
  'error',
  'warning',
  'info',
];

const DIMENSION_WEIGHTS: Readonly<Record<ReviewDimension, number>> = {
  srp: 3,
  abstraction: 3,
  naming: 2,
  dry: 2,
  coupling: 3,
  readability: 2,
  consistency: 1,
};

const TOTAL_WEIGHT = Object.values(DIMENSION_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0,
);

export function calculateOverallScore(scores: DimensionScores): number {
  const weightedScore = REVIEW_DIMENSIONS.reduce(
    (total, dimension) =>
      total + scores[dimension].score * DIMENSION_WEIGHTS[dimension],
    0,
  );

  return Math.round((weightedScore * 10) / TOTAL_WEIGHT);
}

export function isReviewResult(value: unknown): value is ReviewResult {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.summary) &&
    isIntegerInRange(value.overall_score, 0, 100) &&
    isDimensionScores(value.dimension_scores) &&
    Array.isArray(value.issues) &&
    value.issues.every((issue) => isReviewIssue(issue)) &&
    Array.isArray(value.highlights) &&
    value.highlights.every((highlight) => isNonEmptyString(highlight))
  );
}

function isDimensionScores(value: unknown): value is DimensionScores {
  if (!isRecord(value)) return false;

  return REVIEW_DIMENSIONS.every((dimension) => {
    const score = value[dimension];
    return (
      isRecord(score) &&
      isIntegerInRange(score.score, 1, 10) &&
      isNonEmptyString(score.note)
    );
  });
}

function isReviewIssue(value: unknown): value is ReviewIssue {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.file_path) &&
    typeof value.line_range === 'string' &&
    isReviewSeverity(value.severity) &&
    isReviewDimension(value.dimension) &&
    isNonEmptyString(value.what) &&
    isNonEmptyString(value.why) &&
    isNonEmptyString(value.suggestion)
  );
}

function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return (
    typeof value === 'string' &&
    REVIEW_SEVERITIES.includes(value as ReviewSeverity)
  );
}

function isReviewDimension(value: unknown): value is ReviewDimension {
  return (
    typeof value === 'string' &&
    REVIEW_DIMENSIONS.includes(value as ReviewDimension)
  );
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
