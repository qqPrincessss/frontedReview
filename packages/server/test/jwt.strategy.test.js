const assert = require('node:assert/strict');
const test = require('node:test');
const {
  JwtStrategy,
} = require('../dist/modules/auth/strategies/jwt.strategy.js');

function createStrategy(secret = 'unit-test-secret') {
  const requestedKeys = [];
  const configService = {
    getOrThrow(key) {
      requestedKeys.push(key);
      return secret;
    },
  };

  return {
    strategy: new JwtStrategy(configService),
    requestedKeys,
  };
}

test('JwtStrategy: 初始化时读取 JWT_SECRET', () => {
  const { requestedKeys } = createStrategy();

  assert.deepEqual(requestedKeys, ['JWT_SECRET']);
});

test('JwtStrategy: 将 JWT payload 转换成认证用户', () => {
  const { strategy } = createStrategy();

  assert.deepEqual(
    strategy.validate({ sub: 'user-1', username: 'cyan' }),
    { id: 'user-1', username: 'cyan' },
  );
});

test('JwtStrategy: 拒绝缺少 sub 或 username 的 payload', () => {
  const { strategy } = createStrategy();

  for (const payload of [
    { sub: '', username: 'cyan' },
    { sub: 'user-1', username: '' },
  ]) {
    assert.throws(
      () => strategy.validate(payload),
      (error) => {
        assert.equal(error.getStatus(), 401);
        assert.equal(error.message, '登录凭证内容无效');
        return true;
      },
    );
  }
});
