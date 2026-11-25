const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true, maxlength: 2000 },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
}, { timestamps: true });

messageSchema.index({ channel: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });

messageSchema.pre('validate', function checkRoom(next) {
  const hasChannel = Boolean(this.channel);
  const hasConversation = Boolean(this.conversation);
  if (hasChannel === hasConversation) {
    next(new Error('Message must belong to a channel or a direct conversation'));
    return;
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
