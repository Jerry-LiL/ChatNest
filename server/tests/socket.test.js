const jwt = require('jsonwebtoken');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const User = require('../src/models/User');
const Message = require('../src/models/Message');
const { createHttpServer } = require('../src/http');
const { resetPresence } = require('../src/sockets/presence');
const { startMemoryDb, clearCollections, stopMemoryDb, register } = require('./helpers');

function waitForEvent(socket, event, predicate = () => true, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

describe('socket handshake', () => {
  let mongod;
  let app;
  let server;
  let io;
  let port;
  const openSockets = [];

  beforeAll(async () => {
    mongod = await startMemoryDb();
    ({ app, server, io } = createHttpServer());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterEach(async () => {
    await Promise.all(openSockets.splice(0).map((socket) => new Promise((resolve) => {
      if (socket.disconnected) {
        resolve();
        return;
      }
      socket.once('disconnect', () => resolve());
      socket.disconnect();
    })));
    resetPresence();
    await clearCollections();
  });

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await stopMemoryDb(mongod);
  });

  function openSocket(options) {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...options,
    });
    openSockets.push(socket);
    return socket;
  }

  function connect(token) {
    const socket = openSocket({ auth: token ? { token } : {} });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket timeout')), 4000);
      socket.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      // Presence is emitted after channel and DM rooms are joined.
      socket.once('presence:update', () => {
        clearTimeout(timer);
        resolve(socket);
      });
    });
  }

  test('rejects a missing, forged, or expired token', async () => {
    await expect(connect()).rejects.toThrow(/authentication required/i);
    await expect(connect('not-a-jwt')).rejects.toThrow(/authentication required/i);

    const expired = jwt.sign(
      { sub: '507f1f77bcf86cd799439011', exp: Math.floor(Date.now() / 1000) - 10 },
      'test-secret',
    );
    await expect(connect(expired)).rejects.toThrow(/authentication required/i);
  });

  test('rejects a token for a deleted account', async () => {
    const created = await register(app);
    await User.deleteOne({ _id: created.body.user.id });
    await expect(connect(created.body.token)).rejects.toThrow(/authentication required/i);
  });

  test('marks a member online and drops them when the last tab closes', async () => {
    const alice = await register(app);
    const bob = await register(app, {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });

    const aliceSocket = openSocket({ auth: { token: alice.body.token } });
    const aliceOnline = waitForEvent(
      aliceSocket,
      'presence:update',
      (payload) => payload.onlineUsers.some((user) => user.username === 'alice'),
    );
    await aliceOnline;

    const bobSocket = openSocket({ auth: { token: bob.body.token } });
    const bothOnline = waitForEvent(
      bobSocket,
      'presence:update',
      (payload) => payload.onlineUsers.length === 2,
    );
    const snapshot = await bothOnline;
    expect(snapshot.onlineUsers.map((user) => user.username).sort()).toEqual(['alice', 'bob']);

    const aliceGone = waitForEvent(
      bobSocket,
      'presence:update',
      (payload) => payload.onlineUsers.every((user) => user.username !== 'alice'),
    );
    aliceSocket.disconnect();
    const remaining = await aliceGone;
    expect(remaining.onlineUsers.map((user) => user.username)).toEqual(['bob']);
  });

  test('relays typing and persists a channel message for room members', async () => {
    const alice = await register(app);
    const bob = await register(app, {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const channels = await request(app)
      .get('/api/channels')
      .set('Authorization', `Bearer ${alice.body.token}`);
    const general = channels.body.joined.find((channel) => channel.name === 'general');

    const aliceSocket = await connect(alice.body.token);
    const bobSocket = await connect(bob.body.token);

    const typing = waitForEvent(bobSocket, 'typing:update');
    let senderSawTyping = false;
    aliceSocket.on('typing:update', () => {
      senderSawTyping = true;
    });
    aliceSocket.emit('typing:start', { roomType: 'channel', roomId: general.id });
    const typingPayload = await typing;
    expect(typingPayload).toMatchObject({
      roomType: 'channel',
      roomId: general.id,
      isTyping: true,
      user: { username: 'alice' },
    });
    expect(senderSawTyping).toBe(false);

    const incoming = waitForEvent(bobSocket, 'message:new');
    const ack = await new Promise((resolve) => {
      aliceSocket.emit('message:send', {
        channelId: general.id,
        content: '  hello team  ',
      }, resolve);
    });
    expect(ack.ok).toBe(true);
    expect(ack.message.content).toBe('hello team');
    const delivered = await incoming;
    expect(delivered.message.id).toBe(ack.message.id);
    expect(delivered.message.sender.username).toBe('alice');

    const history = await request(app)
      .get(`/api/channels/${general.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.token}`);
    expect(history.body.messages.map((message) => message.content)).toContain('hello team');
  });

  test('refuses a channel message from someone who has not joined', async () => {
    const alice = await register(app);
    const bob = await register(app, {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const created = await request(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${alice.body.token}`)
      .send({ name: 'releases' });
    const bobSocket = await connect(bob.body.token);
    const ack = await new Promise((resolve) => {
      bobSocket.emit('message:send', {
        channelId: created.body.channel.id,
        content: 'shipping now',
      }, resolve);
    });
    expect(ack.ok).toBe(false);
    const stored = await Message.countDocuments({ channel: created.body.channel.id });
    expect(stored).toBe(0);
  });

  test('delivers a direct message to the other participant', async () => {
    const alice = await register(app);
    const bob = await register(app, {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
    });
    const opened = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.body.token}`)
      .send({ userId: bob.body.user.id });
    const conversationId = opened.body.conversation.id;

    const aliceSocket = await connect(alice.body.token);
    const bobSocket = await connect(bob.body.token);
    const incoming = waitForEvent(
      bobSocket,
      'message:new',
      (payload) => payload.message.conversation === conversationId,
    );
    aliceSocket.emit('message:send', {
      conversationId,
      content: 'are you around?',
    });
    const delivered = await incoming;
    expect(delivered.message.content).toBe('are you around?');
    expect(delivered.message.sender.displayName).toBe('Alice');
  });
});
