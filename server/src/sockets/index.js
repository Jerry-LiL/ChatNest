const Channel = require('../models/Channel');
const Conversation = require('../models/Conversation');
const HttpError = require('../errors');
const { verifySocketUser } = require('../middleware/auth');
const { createMessage } = require('../services/messages');
const { serializeMessage } = require('../utils/serialize');
const presence = require('./presence');

function roomKey(type, id) {
  return `${type}:${id}`;
}

function tokenFromHandshake(handshake) {
  if (handshake.auth && handshake.auth.token) return handshake.auth.token;
  const header = handshake.headers?.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function joinMemberships(socket) {
  const userId = socket.user.id;
  const channels = await Channel.find({ members: userId }).select('_id');
  channels.forEach((channel) => socket.join(roomKey('channel', channel._id.toString())));
  const conversations = await Conversation.find({ participants: userId }).select('_id');
  conversations.forEach((conversation) => {
    socket.join(roomKey('conversation', conversation._id.toString()));
  });
}

function relayTyping(socket, payload, isTyping) {
  const roomType = payload?.roomType;
  const roomId = payload?.roomId;
  if ((roomType !== 'channel' && roomType !== 'conversation') || !roomId) return;
  const name = roomKey(roomType, String(roomId));
  if (!socket.rooms.has(name)) return;
  socket.to(name).emit('typing:update', {
    roomType,
    roomId: String(roomId),
    isTyping: Boolean(isTyping),
    user: socket.user,
  });
}

function reply(ack, body) {
  if (typeof ack === 'function') ack(body);
}

function registerSockets(io) {
  io.use(async (socket, next) => {
    try {
      socket.user = await verifySocketUser(tokenFromHandshake(socket.handshake));
      next();
    } catch (err) {
      next(new Error(err.message || 'Authentication required'));
    }
  });

  io.on('connection', async (socket) => {
    presence.noteConnect(socket);
    socket.join(roomKey('user', socket.user.id));
    try {
      await joinMemberships(socket);
    } catch (err) {
      console.error(err);
    }
    io.emit('presence:update', { onlineUsers: presence.listOnline() });

    socket.on('room:join', async (payload = {}, ack) => {
      try {
        const { roomType, roomId } = payload;
        if (roomType !== 'channel' && roomType !== 'conversation') {
          throw new HttpError(400, 'Unknown room');
        }
        if (roomType === 'channel') {
          const channel = await Channel.findById(roomId);
          if (!channel || !channel.members.some((id) => id.equals(socket.user.id))) {
            throw new HttpError(403, 'Join this channel first');
          }
        } else {
          const conversation = await Conversation.findById(roomId);
          if (!conversation || !conversation.participants.some((id) => id.equals(socket.user.id))) {
            throw new HttpError(403, 'You are not part of this conversation');
          }
        }
        socket.join(roomKey(roomType, String(roomId)));
        reply(ack, { ok: true });
      } catch (err) {
        reply(ack, { ok: false, error: err.status ? err.message : 'Could not join room' });
      }
    });

    socket.on('typing:start', (payload) => relayTyping(socket, payload, true));
    socket.on('typing:stop', (payload) => relayTyping(socket, payload, false));

    socket.on('message:send', async (payload = {}, ack) => {
      try {
        const { message, roomType, roomId } = await createMessage({
          senderId: socket.user.id,
          content: payload.content,
          channelId: payload.channelId,
          conversationId: payload.conversationId,
        });
        const name = roomKey(roomType, roomId);
        socket.join(name);
        const body = { message: serializeMessage(message) };
        io.to(name).emit('message:new', body);
        reply(ack, { ok: true, message: body.message });
      } catch (err) {
        if (!err.status || err.status >= 500) console.error(err);
        const error = err.status && err.status < 500 ? err.message : 'Could not send message';
        reply(ack, { ok: false, error });
      }
    });

    socket.on('disconnect', () => {
      const wentOffline = presence.noteDisconnect(socket);
      if (wentOffline) {
        io.emit('presence:update', { onlineUsers: presence.listOnline() });
      }
    });
  });
}

module.exports = { registerSockets, roomKey };
