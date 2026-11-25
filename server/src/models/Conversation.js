const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    validate: {
      validator: (value) => value.length === 2,
      message: 'A direct message needs two people',
    },
  },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

conversationSchema.index({ participants: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
