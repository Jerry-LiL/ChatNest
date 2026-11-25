const Conversation = require('../models/Conversation');
const User = require('../models/User');
const HttpError = require('../errors');

async function openConversation(userId, otherUserId) {
  if (!otherUserId || String(userId) === String(otherUserId)) {
    throw new HttpError(400, 'Choose someone else to message');
  }
  const other = await User.findById(otherUserId).select('_id');
  if (!other) throw new HttpError(404, 'User not found');
  const participants = [String(userId), String(otherUserId)].sort();
  let conversation = await Conversation.findOne({ participants });
  let created = false;
  if (!conversation) {
    conversation = await Conversation.create({ participants });
    created = true;
  }
  return { conversation, created };
}

module.exports = { openConversation };
