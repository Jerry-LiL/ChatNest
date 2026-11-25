import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export function useWorkspace(token, socket) {
  const [channels, setChannels] = useState({ joined: [], available: [] });
  const [conversations, setConversations] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [channelData, conversationData, peopleData] = await Promise.all([
        api.channels(token),
        api.conversations(token),
        api.users(token),
      ]);
      setChannels({
        joined: channelData.joined || [],
        available: channelData.available || [],
      });
      setConversations(conversationData.conversations || []);
      setPeople(peopleData.users || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => { reload(); };
    socket.on('channel:created', refresh);
    return () => socket.off('channel:created', refresh);
  }, [socket, reload]);

  return { channels, conversations, people, error, reload };
}
