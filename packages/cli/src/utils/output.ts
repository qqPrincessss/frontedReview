import chalk from 'chalk';

interface ReviewIssue {
  file_path: string;
  line_range?: string;
  severity: 'error' | 'warning' | 'info';
  dimension: string;
  what: string;
  why: string;
  suggestion: string;
}

interface ReviewOutput {
  id: string;
  summary?: string;
  overall_score?: number;
  dimension_scores?: Record<string, { score: number; note: string }>;
  issues?: ReviewIssue[];
  highlights?: string[];
  status?: string;
  created_at?: string;
}

const severityOrder = { error: 0, warning: 1, info: 2 };

export function printReview(review: ReviewOutput): void {
  console.log('');
  console.log(chalk.bold('════════════ CodeReview AI ════════════'));
  console.log(`  ID: ${review.id}`);
  console.log(`  综合评分: ${formatScore(review.overall_score)}`);
  console.log(`  摘要: ${review.summary || '暂无摘要'}`);
  console.log(chalk.bold('═══════════════════════════════════════'));

  if (review.dimension_scores) {
    console.log('\n维度评分:');
    Object.entries(review.dimension_scores).forEach(([name, value]) => {
      console.log(`  ${name.padEnd(12)} ${value.score}/10${value.note ? `  ${value.note}` : ''}`);
    });
  }

  const issues = [...(review.issues || [])].sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity],
  );
  if (issues.length > 0) {
    console.log(`\n发现 ${issues.length} 个问题:`);
    issues.forEach((issue) => {
      console.log(
        `\n  ${severityLabel(issue.severity)} [${issue.dimension}] ${issue.file_path}:${issue.line_range || ''}`,
      );
      console.log(`    问题: ${issue.what}`);
      console.log(`    原因: ${issue.why}`);
      console.log(`    建议: ${issue.suggestion}`);
    });
  }

  if (review.highlights?.length) {
    console.log('\n亮点:');
    review.highlights.forEach((highlight) =>
      console.log(chalk.green(`  ✓ ${highlight}`)),
    );
  }
}

function formatScore(score?: number): string {
  if (score === undefined || score === null) return chalk.gray('--/100');
  const output = `${score}/100`;
  if (score >= 80) return chalk.green(output);
  if (score >= 60) return chalk.yellow(output);
  return chalk.red(output);
}

function severityLabel(severity: ReviewIssue['severity']): string {
  if (severity === 'error') return chalk.red('✗ ERROR');
  if (severity === 'warning') return chalk.yellow('! WARNING');
  return chalk.blue('i INFO');
}
