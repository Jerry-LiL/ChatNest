import { Composer } from './Composer';
import { MessageList } from './MessageList';

export function typingLabel(users) {
  const names = users.map((user) => user.displayName || user.username);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return 'Several people are typing';
}

export function MessagePane({
  room,
  connected,
  onlineUsers,
  messages,
  hasMore,
  loading,
  loadingOlder,
  typingUsers,
  error,
  onLoadOlder,
  onSend,
  onTyping,
  onLeave,
}) {
  if (!room) {
    return (
      <section className="pane empty-pane">
        <h1>Pick a conversation</h1>
        <p>Channels are on the left. Direct messages sit just under them.</p>
      </section>
    );
  }

  const title = room.type === 'channel' ? `# ${room.title}` : room.title;
  const onlineCount = room.type === 'channel'
    ? (room.members || []).filter((member) => onlineUsers.some((user) => user.id === member.id)).length
    : (onlineUsers.some((user) => user.id === room.peer?.id) ? 1 : 0);
  const label = typingLabel(typingUsers);

  return (
    <section className="pane">
      <header className="pane-header">
        <div>
          <h1>{title}</h1>
          <p className="muted">
            {room.type === 'channel' ? (room.description || 'Channel') : 'Direct message'}
            {' · '}
            {connected ? 'Live' : 'Connecting…'}
            {room.type === 'channel' ? ` · ${onlineCount} online` : (onlineCount ? ' · online' : '')}
          </p>
        </div>
        {room.type === 'channel' && room.title !== 'general' && (
          <button type="button" className="ghost" onClick={onLeave}>Leave</button>
        )}
      </header>
      {error && <p className="banner-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-thread">Loading messages…</p>
      ) : (
        <MessageList
          messages={messages}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
        />
      )}
      <p className="typing" aria-live="polite">{label || '\u00a0'}</p>
      <Composer onSend={onSend} onTyping={onTyping} disabled={!connected} />
    </section>
  );
}
