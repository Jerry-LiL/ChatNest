function serializeUser(user, { includeEmail = false } = {}) {
  const payload = {
    id: (user._id || user.id).toString(),
    username: user.username,
    displayName: user.displayName,
  };
  if (includeEmail) payload.email = user.email;
  return payload;
}

function serializeChannel(channel) {
  const members = (channel.members || []).filter(Boolean).map((member) => {
    if (member.username) return serializeUser(member);
    return { id: member.toString() };
  });
  return {
    id: channel._id.toString(),
    name: channel.name,
    description: channel.description || '',
    memberCount: members.length,
    members,
  };
}

function refId(value) {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
}

function serializeMessage(message) {
  const sender = message.sender && message.sender.username
    ? serializeUser(message.sender)
    : { id: String(message.sender) };
  return {
    id: message._id.toString(),
    content: message.content,
    sender,
    channel: refId(message.channel),
    conversation: refId(message.conversation),
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

function serializeConversation(conversation, currentUserId) {
  const participants = (conversation.participants || []).map((person) => (
    person && person.username ? serializeUser(person) : { id: person.toString() }
  ));
  const peer = participants.find((person) => person.id !== String(currentUserId)) || null;
  return {
    id: conversation._id.toString(),
    participants,
    peer,
    lastMessageAt: conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toISOString()
      : null,
  };
}

module.exports = {
  serializeUser,
  serializeChannel,
  serializeMessage,
  serializeConversation,
};
