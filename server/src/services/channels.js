const Channel = require('../models/Channel');
const HttpError = require('../errors');
const { slugifyChannelName } = require('../validation');

const GENERAL_CHANNEL = 'general';

async function ensureGeneralChannel() {
  return Channel.findOneAndUpdate(
    { name: GENERAL_CHANNEL },
    {
      $setOnInsert: {
        name: GENERAL_CHANNEL,
        description: 'Workspace-wide conversation',
        members: [],
      },
    },
    { new: true, upsert: true },
  );
}

async function joinGeneral(userId) {
  const general = await ensureGeneralChannel();
  await Channel.updateOne({ _id: general._id }, { $addToSet: { members: userId } });
  return general;
}

async function createChannel({ name, description, userId }) {
  const slug = slugifyChannelName(name);
  const existing = await Channel.findOne({ name: slug });
  if (existing) throw new HttpError(409, 'A channel with that name already exists');
  const about = typeof description === 'string' ? description.trim().slice(0, 200) : '';
  return Channel.create({
    name: slug,
    description: about,
    createdBy: userId,
    members: [userId],
  });
}

function assertCanLeave(channel) {
  if (channel.name === GENERAL_CHANNEL) {
    throw new HttpError(400, 'The general channel stays open for everyone');
  }
}

module.exports = {
  GENERAL_CHANNEL,
  ensureGeneralChannel,
  joinGeneral,
  createChannel,
  assertCanLeave,
};
