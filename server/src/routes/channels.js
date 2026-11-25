const express = require('express');
const Channel = require('../models/Channel');
const HttpError = require('../errors');
const { wrap } = require('../utils/async');
const { requireAuth } = require('../middleware/auth');
const { createChannel, assertCanLeave } = require('../services/channels');
const { listChannelMessages } = require('../services/messages');
const { serializeChannel, serializeMessage } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const channels = await Channel.find()
    .populate('members', 'username displayName')
    .sort({ name: 1 });
  const joined = [];
  const available = [];
  channels.forEach((channel) => {
    const isMember = channel.members.some((member) => member && member._id.equals(req.userId));
    (isMember ? joined : available).push(serializeChannel(channel));
  });
  res.json({ joined, available });
}));

router.post('/', wrap(async (req, res) => {
  const channel = await createChannel({
    name: req.body?.name,
    description: req.body?.description,
    userId: req.userId,
  });
  const populated = await channel.populate('members', 'username displayName');
  const payload = serializeChannel(populated);
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${req.userId}`).socketsJoin(`channel:${payload.id}`);
    io.emit('channel:created', { channel: payload });
  }
  res.status(201).json({ channel: payload });
}));

router.post('/:id/join', wrap(async (req, res) => {
  const channel = await Channel.findById(req.params.id);
  if (!channel) throw new HttpError(404, 'Channel not found');
  await Channel.updateOne({ _id: channel._id }, { $addToSet: { members: req.userId } });
  const updated = await Channel.findById(channel._id).populate('members', 'username displayName');
  const payload = serializeChannel(updated);
  const io = req.app.get('io');
  if (io) io.to(`user:${req.userId}`).socketsJoin(`channel:${payload.id}`);
  res.json({ channel: payload });
}));

router.post('/:id/leave', wrap(async (req, res) => {
  const channel = await Channel.findById(req.params.id);
  if (!channel) throw new HttpError(404, 'Channel not found');
  assertCanLeave(channel);
  await Channel.updateOne({ _id: channel._id }, { $pull: { members: req.userId } });
  const io = req.app.get('io');
  if (io) io.to(`user:${req.userId}`).socketsLeave(`channel:${channel._id.toString()}`);
  res.json({ ok: true });
}));

router.get('/:id/messages', wrap(async (req, res) => {
  const { messages, nextCursor } = await listChannelMessages({
    channelId: req.params.id,
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
