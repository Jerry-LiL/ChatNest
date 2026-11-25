const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, maxlength: 32 },
  description: { type: String, default: '', maxlength: 200 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

channelSchema.index({ members: 1 });

module.exports = mongoose.model('Channel', channelSchema);
