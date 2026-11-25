async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: ({ email, password }) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/api/auth/me', { token }),
  channels: (token) => request('/api/channels', { token }),
  createChannel: (token, body) => request('/api/channels', { token, method: 'POST', body }),
  joinChannel: (token, id) => request(`/api/channels/${id}/join`, { token, method: 'POST' }),
  leaveChannel: (token, id) => request(`/api/channels/${id}/leave`, { token, method: 'POST' }),
  conversations: (token) => request('/api/conversations', { token }),
  openConversation: (token, userId) => request('/api/conversations', {
    token,
    method: 'POST',
    body: { userId },
  }),
  users: (token) => request('/api/users', { token }),
  messages(token, room, { cursor, limit = 30 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const base = room.type === 'channel'
      ? `/api/channels/${room.id}/messages`
      : `/api/conversations/${room.id}/messages`;
    return request(`${base}?${params.toString()}`, { token });
  },
};
