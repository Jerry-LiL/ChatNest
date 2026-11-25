import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export function useChatRoom(socket, token, room) {
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const loadingOlderRef = useRef(false);
  const roomId = room?.id || null;
  const roomType = room?.type || null;

  useEffect(() => {
    if (!token || !roomId || !roomType) {
      setMessages([]);
      setNextCursor(null);
      setLoading(false);
      return undefined;
    }
    const stamp = requestId.current + 1;
    requestId.current = stamp;
    setLoading(true);
    setError('');
    setTypingUsers([]);
    setMessages([]);
    setNextCursor(null);
    api.messages(token, { id: roomId, type: roomType })
      .then((data) => {
        if (stamp !== requestId.current) return;
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        if (stamp !== requestId.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (stamp === requestId.current) setLoading(false);
      });
    return undefined;
  }, [token, roomId, roomType]);

  useEffect(() => {
    if (!socket || !roomId || !roomType) return undefined;
    const onMessage = ({ message }) => {
      const matches = roomType === 'channel'
        ? message.channel === roomId
        : message.conversation === roomId;
      if (!matches) return;
      setMessages((prev) => (
        prev.some((item) => item.id === message.id) ? prev : [...prev, message]
      ));
      setTypingUsers((prev) => prev.filter((person) => person.id !== message.sender.id));
    };
    const onTyping = (payload) => {
      if (payload.roomId !== roomId || payload.roomType !== roomType) return;
      setTypingUsers((prev) => {
        const without = prev.filter((person) => person.id !== payload.user.id);
        return payload.isTyping ? [...without, payload.user] : without;
      });
    };
    socket.on('message:new', onMessage);
    socket.on('typing:update', onTyping);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('typing:update', onTyping);
    };
  }, [socket, roomId, roomType]);

  const loadOlder = useCallback(async () => {
    if (!token || !roomId || !roomType || !nextCursor || loadingOlderRef.current) return;
    const stamp = requestId.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await api.messages(token, { id: roomId, type: roomType }, { cursor: nextCursor });
      if (stamp !== requestId.current) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const older = data.messages.filter((item) => !seen.has(item.id));
        return [...older, ...prev];
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (stamp === requestId.current) setError(err.message);
    } finally {
      loadingOlderRef.current = false;
      if (stamp === requestId.current) setLoadingOlder(false);
    }
  }, [token, roomId, roomType, nextCursor]);

  const send = useCallback((content) => new Promise((resolve, reject) => {
    if (!socket || !roomId || !roomType) {
      reject(new Error('Not connected'));
      return;
    }
    const payload = roomType === 'channel'
      ? { channelId: roomId, content }
      : { conversationId: roomId, content };
    socket.emit('typing:stop', { roomType, roomId });
    socket.emit('message:send', payload, (result) => {
      if (!result?.ok) reject(new Error(result?.error || 'Could not send message'));
      else resolve(result.message);
    });
  }), [socket, roomId, roomType]);

  const setTyping = useCallback((isTyping) => {
    if (!socket || !roomId || !roomType) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { roomType, roomId });
  }, [socket, roomId, roomType]);

  return {
    messages,
    nextCursor,
    loading,
    loadingOlder,
    typingUsers,
    error,
    loadOlder,
    send,
    setTyping,
  };
}
