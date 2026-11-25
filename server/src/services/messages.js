const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Conversation = require('../models/Conversation');
const HttpError = require('../errors');
const { encodeCursor, decodeCursor, pageLimit } = require('../utils/cursor');

function olderThan(cursor) {
  const { createdAt, id } = decodeCursor(cursor);
  return {
    $or: [
      { createdAt: { $lt: createdAt } },
      { createdAt, _id: { $lt: id } },
    ],
  };
}

async function assertChannelMember(channelId, userId) {
  const channel = await Channel.findById(channelId);
  if (!channel) throw new HttpError(404, 'Channel not found');
  if (!channel.members.some((id) => id.equals(userId))) {
    throw new HttpError(403, 'Join this channel first');
  }
  return channel;
}

async function assertConversationMember(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new HttpError(404, 'Conversation not found');
  if (!conversation.participants.some((id) => id.equals(userId))) {
    throw new HttpError(403, 'You are not part of this conversation');
  }
  return conversation;
}

async function listMessages({ filter, cursor, limit }) {
  const query = { ...filter };
  if (cursor) Object.assign(query, olderThan(cursor));
  const size = pageLimit(limit);
  // One extra row tells us whether an older page exists.
  const docs = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(size + 1)
    .populate('sender', 'username displayName');
  const hasMore = docs.length > size;
  const page = hasMore ? docs.slice(0, size) : docs;
  const chronological = page.slice().reverse();
  const oldest = chronological[0];
  return {
    messages: chronological,
    nextCursor: hasMore && oldest ? encodeCursor(oldest) : null,
  };
}

async function listChannelMessages({ channelId, userId, cursor, limit }) {
  await assertChannelMember(channelId, userId);
  return listMessages({ filter: { channel: channelId }, cursor, limit });
}

async function listConversationMessages({ conversationId, userId, cursor, limit }) {
  await assertConversationMember(conversationId, userId);
  return listMessages({ filter: { conversation: conversationId }, cursor, limit });
}

async function createMessage({ senderId, content, channelId, conversationId }) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text || text.length > 2000) {
    throw new HttpError(400, 'Message must be between 1 and 2000 characters');
  }
  if (Boolean(channelId) === Boolean(conversationId)) {
    throw new HttpError(400, 'Choose a channel or a direct message');
  }

  if (channelId) {
    const channel = await assertChannelMember(channelId, senderId);
    const message = await Message.create({
      content: text,
      sender: senderId,
      channel: channel._id,
    });
    await message.populate('sender', 'username displayName');
    return { message, roomType: 'channel', roomId: channel._id.toString() };
  }

  const conversation = await assertConversationMember(conversationId, senderId);
  const message = await Message.create({
    content: text,
    sender: senderId,
    conversation: conversation._id,
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();
  await message.populate('sender', 'username displayName');
  return { message, roomType: 'conversation', roomId: conversation._id.toString() };
}

module.exports = {
  listChannelMessages,
  listConversationMessages,
  createMessage,
};
