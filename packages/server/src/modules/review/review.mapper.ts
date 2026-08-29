import { Review, ReviewIssue } from '@prisma/client';

type ReviewWithIssues = Review & { issues: ReviewIssue[] };
type ReviewListRecord = Pick<
  Review,
  | 'id'
  | 'summary'
  | 'overallScore'
  | 'language'
  | 'branchFrom'
  | 'branchTo'
  | 'status'
  | 'createdAt'
> & { _count: { issues: number } };

export function toReviewDetail(review: ReviewWithIssues) {
  return {
    id: review.id,
    diff_content: review.diffContent,
    language: review.language,
    branch_from: review.branchFrom,
    branch_to: review.branchTo,
    summary: review.summary,
    overall_score: review.overallScore,
    dimension_scores: review.dimensionScores,
    highlights: Array.isArray(review.highlights) ? review.highlights : [],
    status: review.status.toLowerCase(),
    created_at: review.createdAt,
    issues: review.issues.map((issue) => ({
      id: issue.id,
      file_path: issue.filePath,
      line_range: issue.lineRange,
      severity: issue.severity.toLowerCase(),
      dimension: issue.dimension,
      what: issue.what,
      why: issue.why,
      suggestion: issue.suggestion,
    })),
  };
}

export function toReviewListItem(review: ReviewListRecord) {
  return {
    id: review.id,
    summary: review.summary,
    overall_score: review.overallScore,
    language: review.language,
    branch_from: review.branchFrom,
    branch_to: review.branchTo,
    issue_count: review._count.issues,
    status: review.status.toLowerCase(),
    created_at: review.createdAt,
  };
}
