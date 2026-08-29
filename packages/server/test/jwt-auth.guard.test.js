const assert = require('node:assert/strict');
const test = require('node:test');
const {
  UnauthorizedException,
  ForbiddenException,
} = require('@nestjs/common');
const {
  JwtAuthGuard,
} = require('../dist/common/guards/jwt-auth.guard.js');

const context = {};

function assertUnauthorized(callback, expectedMessage) {
  assert.throws(callback, (error) => {
    assert.equal(error.getStatus(), 401);
    assert.equal(error.message, expectedMessage);
    return true;
  });
}

test('JwtAuthGuard: 合法认证用户正常放行', () => {
  const guard = new JwtAuthGuard();
  const user = { id: 'user-1', username: 'cyan' };

  assert.equal(guard.handleRequest(null, user, null, context), user);
});

test('JwtAuthGuard: 未携带 Token 时返回明确的 401', () => {
  const guard = new JwtAuthGuard();

  assertUnauthorized(
    () => guard.handleRequest(null, null, { message: 'No auth token' }, context),
    '请先登录',
  );
});

test('JwtAuthGuard: Token 过期时提示重新登录', () => {
  const guard = new JwtAuthGuard();

  assertUnauthorized(
    () =>
      guard.handleRequest(
        null,
        null,
        { name: 'TokenExpiredError', message: 'jwt expired' },
        context,
      ),
    '登录凭证已过期，请重新登录',
  );
});

test('JwtAuthGuard: 签名错误和尚未生效的 Token 均判定无效', () => {
  const guard = new JwtAuthGuard();

  for (const name of ['JsonWebTokenError', 'NotBeforeError']) {
    assertUnauthorized(
      () => guard.handleRequest(null, null, { name }, context),
      '登录凭证无效',
    );
  }
});

test('JwtAuthGuard: 保留 Strategy 主动抛出的 HTTP 异常', () => {
  const guard = new JwtAuthGuard();
  const exception = new ForbiddenException('账号已禁用');

  assert.throws(
    () => guard.handleRequest(exception, null, null, context),
    (error) => error === exception,
  );
});

test('JwtAuthGuard: 拒绝结构不完整的 request.user', () => {
  const guard = new JwtAuthGuard();

  assertUnauthorized(
    () => guard.handleRequest(null, { id: '', username: 'cyan' }, null, context),
    '身份验证失败',
  );
  assertUnauthorized(
    () => guard.handleRequest(null, { id: 'user-1' }, null, context),
    '身份验证失败',
  );
});
