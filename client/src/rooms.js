export function channelRoom(channel) {
  return {
    type: 'channel',
    id: channel.id,
    title: channel.name,
    description: channel.description,
    members: channel.members || [],
  };
}

export function conversationRoom(conversation) {
  return {
    type: 'conversation',
    id: conversation.id,
    title: conversation.peer?.displayName || 'Direct message',
    peer: conversation.peer || null,
  };
}
