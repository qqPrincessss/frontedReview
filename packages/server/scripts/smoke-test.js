const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const workspaceRoot = join(__dirname, '..', '..', '..');
const serverRoot = join(workspaceRoot, 'packages', 'server');
const cliRoot = join(workspaceRoot, 'packages', 'cli');
const reportPath = join(serverRoot, 'dist', 'smoke-test-result.json');
const results = [];

async function test(name, callback) {
  const startedAt = Date.now();
  try {
    await callback();
    results.push({ name, status: 'passed', duration_ms: Date.now() - startedAt });
  } catch (error) {
    results.push({
      name,
      status: 'failed',
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
  }
}

async function run() {
  await test('Prisma Client exposes generated models and enums', async () => {
    const { PrismaClient, Severity } = require(join(
      serverRoot,
      'node_modules',
      '@prisma',
      'client',
    ));
    const prisma = new PrismaClient();

    assert.equal(Severity.ERROR, 'ERROR');
    assert.equal(typeof prisma.review.findMany, 'function');
    assert.equal(typeof prisma.reviewIssue.createMany, 'function');
    assert.equal(typeof prisma.$transaction, 'function');
    await prisma.$disconnect();
  });

  await test('JwtAuthGuard accepts users and maps token failures to 401', async () => {
    const { JwtAuthGuard } = require(join(
      serverRoot,
      'dist',
      'common',
      'guards',
      'jwt-auth.guard.js',
    ));
    const guard = new JwtAuthGuard();
    const context = {};
    const user = { id: 'user-smoke-test', username: 'smoke-user' };

    assert.equal(guard.handleRequest(null, user, null, context), user);
    assert.throws(
      () => guard.handleRequest(null, null, { message: 'No auth token' }, context),
      (error) => error.getStatus() === 401 && error.message === '请先登录',
    );
    assert.throws(
      () =>
        guard.handleRequest(
          null,
          null,
          { name: 'TokenExpiredError', message: 'jwt expired' },
          context,
        ),
      (error) =>
        error.getStatus() === 401 &&
        error.message === '登录凭证已过期，请重新登录',
    );
  });

  await test('ReportService generates a valid PDF buffer', async () => {
    const { ReportService } = require(join(
      serverRoot,
      'dist',
      'modules',
      'report',
      'report.service.js',
    ));
    const review = {
      id: 'review-smoke-test',
      userId: 'user-smoke-test',
      diffContent: '+ const answer = 42;',
      language: 'typescript',
      branchFrom: 'main',
      branchTo: 'feature/smoke',
      summary: '局部测试报告',
      overallScore: 88,
      dimensionScores: { srp: { score: 9, note: '职责清晰' } },
      highlights: ['类型明确'],
      status: 'COMPLETED',
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      issues: [],
    };
    const service = new ReportService(
      { review: { findUnique: async () => review } },
      { get: () => undefined },
    );

    const pdf = await service.generatePdf(review.id, review.userId);
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(pdf.length > 1000, `PDF buffer too small: ${pdf.length}`);
  });

  await test('CLI executable exposes all documented commands', async () => {
    const cliPath = join(cliRoot, 'dist', 'bin', 'review.js');
    const result = spawnSync(process.execPath, [cliPath, '--help'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const command of [
      'login',
      'logout',
      'submit',
      'history',
      'show',
      'feedback',
    ]) {
      assert.match(result.stdout, new RegExp(`\\b${command}\\b`));
    }
  });

  const failed = results.filter((result) => result.status === 'failed');
  const report = {
    status: failed.length === 0 ? 'passed' : 'failed',
    passed: results.length - failed.length,
    failed: failed.length,
    total: results.length,
    generated_at: new Date().toISOString(),
    results,
  };

  mkdirSync(join(serverRoot, 'dist'), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  mkdirSync(join(serverRoot, 'dist'), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        status: 'failed',
        fatal_error: error instanceof Error ? error.stack || error.message : String(error),
      },
      null,
      2,
    ),
    'utf8',
  );
  process.exitCode = 1;
});
