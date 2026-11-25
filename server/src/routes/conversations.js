const express = require('express');
const Conversation = require('../models/Conversation');
const { wrap } = require('../utils/async');
const { requireAuth } = require('../middleware/auth');
const { openConversation } = require('../services/conversations');
const { listConversationMessages } = require('../services/messages');
const { serializeConversation, serializeMessage } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.userId })
    .populate('participants', 'username displayName')
    .sort({ lastMessageAt: -1, updatedAt: -1 });
  res.json({
    conversations: conversations.map((conversation) => serializeConversation(conversation, req.userId)),
  });
}));

router.post('/', wrap(async (req, res) => {
  const { conversation, created } = await openConversation(req.userId, req.body?.userId);
  const populated = await conversation.populate('participants', 'username displayName');
  const payload = serializeConversation(populated, req.userId);
  const io = req.app.get('io');
  if (io) {
    populated.participants.forEach((person) => {
      io.to(`user:${person._id.toString()}`).socketsJoin(`conversation:${payload.id}`);
    });
  }
  res.status(created ? 201 : 200).json({ conversation: payload });
}));

router.get('/:id/messages', wrap(async (req, res) => {
  const { messages, nextCursor } = await listConversationMessages({
    conversationId: req.params.id,
    userId: req.userId,
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.json({
    messages: messages.map(serializeMessage),
    nextCursor,
  });
}));

module.exports = router;
