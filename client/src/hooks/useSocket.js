import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// The socket lives as long as the access token does. A new token replaces it.
// Connected flips true only after the server has joined this user's rooms and
// sent the presence snapshot, so typing and sends are not racing the handshake.
export function useSocket(token, { onUnauthorized } = {}) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      setOnlineUsers([]);
      return undefined;
    }

    const instance = io({
      auth: { token },
      autoConnect: true,
      reconnection: true,
    });

    const handlePresence = (payload) => {
      setOnlineUsers(payload.onlineUsers || []);
      setConnected(true);
    };
    const handleDisconnect = () => setConnected(false);
    const handleError = (err) => {
      setConnected(false);
      if (/authentication/i.test(err?.message || '')) {
        instance.disconnect();
        if (onUnauthorized) onUnauthorized();
      }
    };

    instance.on('presence:update', handlePresence);
    instance.on('disconnect', handleDisconnect);
    instance.on('connect_error', handleError);
    setSocket(instance);

    return () => {
      instance.off('presence:update', handlePresence);
      instance.off('disconnect', handleDisconnect);
      instance.off('connect_error', handleError);
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token, onUnauthorized]);

  return { socket, connected, onlineUsers };
}
