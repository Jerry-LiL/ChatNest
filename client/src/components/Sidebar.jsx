import { useState } from 'react';

export function Sidebar({
  user,
  connected,
  channels,
  conversations,
  people,
  onlineUsers,
  active,
  unread,
  onSelect,
  onCreateChannel,
  onJoinChannel,
  onStartDm,
  onLogout,
}) {
  const [channelName, setChannelName] = useState('');
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [error, setError] = useState('');
  const onlineIds = new Set(onlineUsers.map((person) => person.id));
  const query = peopleQuery.trim().toLowerCase();
  const filteredPeople = people.filter((person) => {
    const haystack = `${person.displayName} ${person.username}`.toLowerCase();
    return haystack.includes(query);
  });
  const visiblePeople = query ? filteredPeople : filteredPeople.slice(0, 8);

  async function createChannel(event) {
    event.preventDefault();
    setError('');
    try {
      await onCreateChannel(channelName);
      setChannelName('');
      setShowChannelForm(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <p className="wordmark">ChatNest</p>
        <span className={connected ? 'status online' : 'status'}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      <section>
        <header className="section-label">
          <span>Channels</span>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowChannelForm((open) => !open)}
          >
            {showChannelForm ? 'Close' : 'Add'}
          </button>
        </header>
        {showChannelForm && (
          <form className="inline-form" onSubmit={createChannel}>
            <label className="sr-only" htmlFor="channel-name">Channel name</label>
            <input
              id="channel-name"
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="design"
            />
            <button type="submit">Create</button>
          </form>
        )}
        <ul className="nav-list">
          {channels.joined.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                className={isActive(active, 'channel', channel.id) ? 'nav-item active' : 'nav-item'}
                onClick={() => onSelect({ channel })}
              >
                <span># {channel.name}</span>
                {unread[`channel:${channel.id}`] ? <em>{unread[`channel:${channel.id}`]}</em> : null}
              </button>
            </li>
          ))}
        </ul>
        {channels.available.length > 0 && (
          <ul className="nav-list available">
            {channels.available.map((channel) => (
              <li key={channel.id}>
                <button
                  type="button"
                  className="nav-item"
                  onClick={() => onJoinChannel(channel).catch((err) => setError(err.message))}
                >
                  <span># {channel.name}</span>
                  <em>Join</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="section-label"><span>Direct messages</span></header>
        <ul className="nav-list">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className={isActive(active, 'conversation', conversation.id) ? 'nav-item active' : 'nav-item'}
                onClick={() => onSelect({ conversation })}
              >
                <span className="person">
                  <i className={onlineIds.has(conversation.peer?.id) ? 'dot on' : 'dot'} />
                  {conversation.peer?.displayName || 'Direct message'}
                </span>
                {unread[`conversation:${conversation.id}`] ? (
                  <em>{unread[`conversation:${conversation.id}`]}</em>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <label className="sr-only" htmlFor="people-search">Find a teammate</label>
        <input
          id="people-search"
          className="people-search"
          value={peopleQuery}
          onChange={(event) => setPeopleQuery(event.target.value)}
          placeholder="Find a teammate"
        />
        <ul className="nav-list people">
          {visiblePeople.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="nav-item"
                onClick={() => onStartDm(person).catch((err) => setError(err.message))}
              >
                <span className="person">
                  <i className={onlineIds.has(person.id) ? 'dot on' : 'dot'} />
                  {person.displayName}
                  <small>@{person.username}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      <footer className="sidebar-user">
        <div>
          <strong>{user.displayName}</strong>
          <small>@{user.username}</small>
        </div>
        <button type="button" className="ghost light" onClick={onLogout}>Log out</button>
      </footer>
    </aside>
  );
}

function isActive(active, type, id) {
  return active?.type === type && active?.id === id;
}
