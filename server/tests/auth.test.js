const request = require('supertest');
const { createApp } = require('../src/app');
const { startMemoryDb, clearCollections, stopMemoryDb, register } = require('./helpers');

describe('auth flows', () => {
  let mongod;
  const app = createApp();

  beforeAll(async () => {
    mongod = await startMemoryDb();
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await stopMemoryDb(mongod);
  });

  test('register returns a token and joins general', async () => {
    const res = await register(app);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

    const channels = await request(app)
      .get('/api/channels')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(channels.status).toBe(200);
    expect(channels.body.joined.map((channel) => channel.name)).toContain('general');
  });

  test('register rejects a duplicate email and a short password', async () => {
    await register(app);
    const duplicate = await register(app, { username: 'alice2' });
    expect(duplicate.status).toBe(409);

    const weak = await register(app, {
      username: 'carol',
      email: 'carol@example.com',
      password: 'short',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toMatch(/password/i);
  });

  test('login accepts the right password and hides which field was wrong', async () => {
    await register(app);
    const ok = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    const badPassword = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password999',
    });
    const unknown = await request(app).post('/api/auth/login').send({
      email: 'missing@example.com',
      password: 'password123',
    });
    expect(badPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(badPassword.body.error).toBe(unknown.body.error);
  });

  test('me requires a valid token', async () => {
    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);

    const garbage = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-token');
    expect(garbage.status).toBe(401);

    const created = await register(app);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${created.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('alice');
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  test('a signed-in user can see teammates but not themselves', async () => {
    const alice = await register(app);
    await register(app, {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${alice.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.map((user) => user.username)).toEqual(['bob']);
  });
});
