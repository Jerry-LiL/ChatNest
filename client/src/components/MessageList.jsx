import { useLayoutEffect, useRef } from 'react';

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '?';
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function sameDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function MessageList({ messages, hasMore, loadingOlder, onLoadOlder }) {
  const scrollerRef = useRef(null);
  const stickToBottom = useRef(true);
  const restoreHeight = useRef(null);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (restoreHeight.current != null) {
      el.scrollTop = el.scrollHeight - restoreHeight.current;
      restoreHeight.current = null;
      return;
    }
    if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < 64;
    if (!hasMore || loadingOlder) return;
    if (el.scrollHeight <= el.clientHeight + 8) return;
    if (el.scrollTop <= 40) {
      // Remember the height so prepending older rows does not jump the viewport.
      restoreHeight.current = el.scrollHeight;
      onLoadOlder();
    }
  }

  return (
    <div
      className="messages"
      data-testid="message-list"
      ref={scrollerRef}
      onScroll={handleScroll}
    >
      {messages.length === 0 && <p className="empty-thread">No messages yet. Say hello.</p>}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const showDay = !previous || !sameDay(previous.createdAt, message.createdAt);
        const grouped = Boolean(previous) && !showDay && previous.sender.id === message.sender.id;
        const name = message.sender.displayName || message.sender.username;
        return (
          <div key={message.id}>
            {showDay && <p className="day-label">{formatDay(message.createdAt)}</p>}
            <article className={grouped ? 'message grouped' : 'message'}>
              {grouped ? (
                <span className="avatar spacer" />
              ) : (
                <span className="avatar" aria-hidden="true">{initials(name)}</span>
              )}
              <div>
                {!grouped && (
                  <header className="message-meta">
                    <strong>{name}</strong>
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  </header>
                )}
                <p className="message-body">{message.content}</p>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
