const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcrypt');
const {
  AuthService,
} = require('../dist/modules/auth/auth.service.js');

function createService(userOverrides = {}, jwtOverrides = {}) {
  const calls = {
    findFirst: [],
    findUnique: [],
    create: [],
    sign: [],
  };

  const prisma = {
    user: {
      async findFirst(args) {
        calls.findFirst.push(args);
        return userOverrides.findFirst ?? null;
      },
      async findUnique(args) {
        calls.findUnique.push(args);
        if (typeof userOverrides.findUnique === 'function') {
          return userOverrides.findUnique(args);
        }
        return userOverrides.findUnique ?? null;
      },
      async create(args) {
        calls.create.push(args);
        if (typeof userOverrides.create === 'function') {
          return userOverrides.create(args);
        }
        return userOverrides.create;
      },
    },
  };

  const jwtService = {
    sign(payload) {
      calls.sign.push(payload);
      return jwtOverrides.token || 'signed-access-token';
    },
  };

  return {
    service: new AuthService(prisma, jwtService),
    calls,
  };
}

function assertHttpError(status, message) {
  return (error) => {
    assert.equal(error.getStatus(), status);
    assert.equal(error.message, message);
    return true;
  };
}

test('AuthService.register: 检查用户名和邮箱并保存密码哈希', async () => {
  const createdAt = new Date('2026-08-29T00:00:00.000Z');
  const { service, calls } = createService({
    create: ({ data }) => ({
      id: 'user-1',
      username: data.username,
      email: data.email,
      createdAt,
    }),
  });

  const result = await service.register({
    username: 'cyan',
    email: 'cyan@example.com',
    password: 'password123',
  });

  assert.deepEqual(calls.findFirst[0], {
    where: {
      OR: [
        { username: 'cyan' },
        { email: 'cyan@example.com' },
      ],
    },
  });
  assert.equal(calls.create.length, 1);
  assert.notEqual(calls.create[0].data.passwordHash, 'password123');
  assert.equal(
    await bcrypt.compare('password123', calls.create[0].data.passwordHash),
    true,
  );
  assert.deepEqual(result, {
    id: 'user-1',
    username: 'cyan',
    email: 'cyan@example.com',
    created_at: createdAt,
  });
});

test('AuthService.register: 用户名或邮箱存在时返回 409', async () => {
  const { service, calls } = createService({
    findFirst: { id: 'existing-user' },
  });

  await assert.rejects(
    () =>
      service.register({
        username: 'cyan',
        email: 'cyan@example.com',
        password: 'password123',
      }),
    assertHttpError(409, '用户名或邮箱已存在'),
  );
  assert.equal(calls.create.length, 0);
});

test('AuthService.login: 正确密码返回签名 Token 和用户信息', async () => {
  const passwordHash = await bcrypt.hash('password123', 4);
  const { service, calls } = createService(
    {
      findUnique: {
        id: 'user-1',
        username: 'cyan',
        passwordHash,
      },
    },
    { token: 'jwt-token' },
  );

  const result = await service.login({
    username: 'cyan',
    password: 'password123',
  });

  assert.deepEqual(calls.sign, [{ sub: 'user-1', username: 'cyan' }]);
  assert.deepEqual(result, {
    access_token: 'jwt-token',
    expires_in: 86400,
    user: { id: 'user-1', username: 'cyan' },
  });
});

test('AuthService.login: 用户不存在和密码错误都返回相同的 401', async (t) => {
  await t.test('用户不存在', async () => {
    const { service } = createService({ findUnique: null });
    await assert.rejects(
      () => service.login({ username: 'missing', password: 'password123' }),
      assertHttpError(401, '用户名或密码错误'),
    );
  });

  await t.test('密码错误', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const { service } = createService({
      findUnique: { id: 'user-1', username: 'cyan', passwordHash },
    });
    await assert.rejects(
      () => service.login({ username: 'cyan', password: 'wrong-password' }),
      assertHttpError(401, '用户名或密码错误'),
    );
  });
});

test('AuthService.getProfile: 返回用户资料和审查数量', async () => {
  const createdAt = new Date('2026-08-29T00:00:00.000Z');
  const { service, calls } = createService({
    findUnique: {
      id: 'user-1',
      username: 'cyan',
      email: 'cyan@example.com',
      createdAt,
      _count: { reviews: 7 },
    },
  });

  const result = await service.getProfile('user-1');

  assert.equal(calls.findUnique[0].where.id, 'user-1');
  assert.deepEqual(result, {
    id: 'user-1',
    username: 'cyan',
    email: 'cyan@example.com',
    created_at: createdAt,
    review_count: 7,
  });
});

test('AuthService.getProfile: 用户不存在时返回 404', async () => {
  const { service } = createService({ findUnique: null });

  await assert.rejects(
    () => service.getProfile('missing-user'),
    assertHttpError(404, '用户不存在'),
  );
});
