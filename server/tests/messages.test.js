const request = require('supertest');
const { createApp } = require('../src/app');
const Message = require('../src/models/Message');
const { startMemoryDb, clearCollections, stopMemoryDb, register } = require('./helpers');

describe('message history', () => {
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

  async function authed(overrides) {
    const res = await register(app, overrides);
    expect(res.status).toBe(201);
    return res.body;
  }

  test('pages channel history with a cursor and does not overlap', async () => {
    const alice = await authed();
    const channels = await request(app)
      .get('/api/channels')
      .set('Authorization', `Bearer ${alice.token}`);
    const general = channels.body.joined.find((channel) => channel.name === 'general');
    const base = new Date('2024-06-01T12:00:00.000Z').getTime();
    await Message.insertMany(Array.from({ length: 45 }, (_, index) => ({
      content: `m-${index}`,
      sender: alice.user.id,
      channel: general.id,
      createdAt: new Date(base + index * 1000),
      updatedAt: new Date(base + index * 1000),
    })));

    let history = [];
    let cursor;
    let pages = 0;
    do {
      const url = `/api/channels/${general.id}/messages?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await request(app).get(url).set('Authorization', `Bearer ${alice.token}`);
      expect(page.status).toBe(200);
      const contents = page.body.messages.map((message) => message.content);
      const indexes = contents.map((content) => Number(content.slice(2)));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      // The first page is the newest window. Older pages are prepended, same as the client.
      history = cursor ? [...contents, ...history] : contents;
      cursor = page.body.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(history).toEqual(Array.from({ length: 45 }, (_, index) => `m-${index}`));
  });

  test('rejects a bad cursor and hides channels you have not joined', async () => {
    const alice = await authed();
    const bob = await authed({
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const created = await request(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Design Reviews', description: 'Critiques' });
    expect(created.status).toBe(201);
    expect(created.body.channel.name).toBe('design-reviews');

    const forbidden = await request(app)
      .get(`/api/channels/${created.body.channel.id}/messages`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(forbidden.status).toBe(403);

    const joined = await request(app)
      .post(`/api/channels/${created.body.channel.id}/join`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(joined.status).toBe(200);

    const channels = await request(app)
      .get('/api/channels')
      .set('Authorization', `Bearer ${alice.token}`);
    const general = channels.body.joined.find((channel) => channel.name === 'general');
    const badCursor = await request(app)
      .get(`/api/channels/${general.id}/messages?cursor=not-a-cursor`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(badCursor.status).toBe(400);

    const cannotLeave = await request(app)
      .post(`/api/channels/${general.id}/leave`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(cannotLeave.status).toBe(400);
  });

  test('opens one direct conversation and pages its messages', async () => {
    const alice = await authed();
    const bob = await authed({
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const carol = await authed({
      username: 'carol',
      email: 'carol@example.com',
      displayName: 'Carol',
    });

    const opened = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.user.id });
    expect(opened.status).toBe(201);
    expect(opened.body.conversation.peer.username).toBe('bob');

    const again = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ userId: alice.user.id });
    expect(again.status).toBe(200);
    expect(again.body.conversation.id).toBe(opened.body.conversation.id);

    const conversationId = opened.body.conversation.id;
    const base = new Date('2024-07-01T12:00:00.000Z').getTime();
    await Message.insertMany([0, 1, 2].map((index) => ({
      content: `dm-${index}`,
      sender: index % 2 === 0 ? alice.user.id : bob.user.id,
      conversation: conversationId,
      createdAt: new Date(base + index * 1000),
      updatedAt: new Date(base + index * 1000),
    })));

    const history = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(history.status).toBe(200);
    expect(history.body.messages.map((message) => message.content)).toEqual(['dm-0', 'dm-1', 'dm-2']);
    expect(history.body.nextCursor).toBeNull();

    const outsider = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${carol.token}`);
    expect(outsider.status).toBe(403);

    const self = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: alice.user.id });
    expect(self.status).toBe(400);
  });
});
