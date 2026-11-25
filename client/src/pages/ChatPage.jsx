import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useWorkspace } from '../hooks/useWorkspace';
import { useChatRoom } from '../hooks/useChatRoom';
import { channelRoom, conversationRoom } from '../rooms';
import { Sidebar } from '../components/Sidebar';
import { MessagePane } from '../components/MessagePane';

export function ChatPage() {
  const { user, token, logout } = useAuth();
  const { socket, connected, onlineUsers } = useSocket(token, { onUnauthorized: logout });
  const workspace = useWorkspace(token, socket);
  const { reload } = workspace;
  const [active, setActive] = useState(null);
  const [unread, setUnread] = useState({});
  const room = useChatRoom(socket, token, active);

  useEffect(() => {
    if (active || workspace.channels.joined.length === 0) return;
    const general = workspace.channels.joined.find((channel) => channel.name === 'general');
    setActive(channelRoom(general || workspace.channels.joined[0]));
  }, [active, workspace.channels.joined]);

  useEffect(() => {
    if (!socket || !user) return undefined;
    const onMessage = ({ message }) => {
      if (message.sender?.id === user.id) return;
      const key = message.channel
        ? `channel:${message.channel}`
        : `conversation:${message.conversation}`;
      const open = active && (
        (message.channel && active.type === 'channel' && active.id === message.channel)
        || (message.conversation && active.type === 'conversation' && active.id === message.conversation)
      );
      if (!open) {
        setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
      if (message.conversation) reload();
    };
    socket.on('message:new', onMessage);
    return () => socket.off('message:new', onMessage);
  }, [socket, user, active, reload]);

  function selectRoom(next) {
    setActive(next);
    setUnread((prev) => ({ ...prev, [`${next.type}:${next.id}`]: 0 }));
  }

  async function createChannel(name) {
    const data = await api.createChannel(token, { name });
    await workspace.reload();
    selectRoom(channelRoom(data.channel));
  }

  async function joinChannel(channel) {
    const data = await api.joinChannel(token, channel.id);
    await workspace.reload();
    selectRoom(channelRoom(data.channel));
  }

  async function startDm(person) {
    const data = await api.openConversation(token, person.id);
    await workspace.reload();
    socket?.emit('room:join', { roomType: 'conversation', roomId: data.conversation.id });
    selectRoom(conversationRoom(data.conversation));
  }

  async function leaveActive() {
    if (!active || active.type !== 'channel') return;
    await api.leaveChannel(token, active.id);
    setActive(null);
    await workspace.reload();
  }

  return (
    <div className="shell">
      <Sidebar
        user={user}
        connected={connected}
        channels={workspace.channels}
        conversations={workspace.conversations}
        people={workspace.people}
        onlineUsers={onlineUsers}
        active={active}
        unread={unread}
        onSelect={({ channel, conversation }) => {
          selectRoom(channel ? channelRoom(channel) : conversationRoom(conversation));
        }}
        onCreateChannel={createChannel}
        onJoinChannel={joinChannel}
        onStartDm={startDm}
        onLogout={logout}
      />
      <MessagePane
        room={active}
        connected={connected}
        onlineUsers={onlineUsers}
        messages={room.messages}
        hasMore={Boolean(room.nextCursor)}
        loading={room.loading}
        loadingOlder={room.loadingOlder}
        typingUsers={room.typingUsers}
        error={room.error || workspace.error}
        onLoadOlder={room.loadOlder}
        onSend={room.send}
        onTyping={room.setTyping}
        onLeave={leaveActive}
      />
    </div>
  );
}
