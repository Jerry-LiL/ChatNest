const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { connectDb } = require('./db');
const User = require('./models/User');
const Channel = require('./models/Channel');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const { ensureGeneralChannel } = require('./services/channels');

async function upsertUser({ username, email, displayName, passwordHash }) {
  return User.findOneAndUpdate(
    { email },
    { username, email, displayName, passwordHash },
    { upsert: true, new: true },
  );
}

async function main() {
  config.assertRuntimeConfig();
  await connectDb();
  const passwordHash = await bcrypt.hash('password123', 10);
  const alice = await upsertUser({
    username: 'alice',
    email: 'alice@chatnest.dev',
    displayName: 'Alice Sharma',
    passwordHash,
  });
  const bob = await upsertUser({
    username: 'bob',
    email: 'bob@chatnest.dev',
    displayName: 'Bob Mehta',
    passwordHash,
  });

  const general = await ensureGeneralChannel();
  await Channel.updateOne(
    { _id: general._id },
    { $addToSet: { members: { $each: [alice._id, bob._id] } } },
  );
  await Channel.findOneAndUpdate(
    { name: 'design' },
    {
      $setOnInsert: {
        name: 'design',
        description: 'Critiques and references',
        createdBy: alice._id,
        members: [alice._id, bob._id],
      },
    },
    { upsert: true },
  );

  const existing = await Message.countDocuments({ channel: general._id });
  if (existing === 0) {
    await Message.create([
      {
        content: 'Welcome to the workspace. This channel is open to everyone.',
        sender: alice._id,
        channel: general._id,
      },
      {
        content: 'I left the homepage notes in #design.',
        sender: bob._id,
        channel: general._id,
      },
    ]);
  }

  const participants = [alice._id.toString(), bob._id.toString()].sort();
  let dm = await Conversation.findOne({ participants });
  if (!dm) {
    dm = await Conversation.create({ participants, lastMessageAt: new Date() });
    await Message.create({
      content: 'Ping me when the review is up.',
      sender: alice._id,
      conversation: dm._id,
    });
  }

  console.log('Seeded alice@chatnest.dev and bob@chatnest.dev (password123)');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
