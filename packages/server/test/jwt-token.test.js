const assert = require('node:assert/strict');
const test = require('node:test');
const { JwtService } = require('@nestjs/jwt');

const secret = 'unit-test-secret-with-enough-length';

test('JwtService: 签发的 Token 可还原用户 payload', () => {
  const jwtService = new JwtService({
    secret,
    signOptions: { expiresIn: '1h' },
  });

  const token = jwtService.sign({ sub: 'user-1', username: 'cyan' });
  const payload = jwtService.verify(token);

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.username, 'cyan');
  assert.equal(typeof payload.iat, 'number');
  assert.equal(typeof payload.exp, 'number');
  assert.ok(payload.exp > payload.iat);
});

test('JwtService: 使用错误密钥不能验证 Token', () => {
  const signer = new JwtService({ secret });
  const verifier = new JwtService({ secret: 'another-secret' });
  const token = signer.sign({ sub: 'user-1', username: 'cyan' });

  assert.throws(() => verifier.verify(token), /invalid signature/i);
});

test('JwtService: 已过期 Token 验证失败', () => {
  const jwtService = new JwtService({ secret });
  const token = jwtService.sign(
    { sub: 'user-1', username: 'cyan' },
    { expiresIn: -1 },
  );

  assert.throws(
    () => jwtService.verify(token),
    (error) => error.name === 'TokenExpiredError',
  );
});
