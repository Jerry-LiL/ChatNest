import { act, render, screen } from '@testing-library/react';
import { io } from 'socket.io-client';
import { useSocket } from './useSocket';

jest.mock('socket.io-client', () => {
  const mockSocket = {
    handlers: {},
    on(event, callback) { this.handlers[event] = callback; },
    off: jest.fn(),
    disconnect: jest.fn(),
  };
  return { io: jest.fn(() => mockSocket), mockSocket };
});

const { mockSocket } = jest.requireMock('socket.io-client');

function Probe({ token, onUnauthorized }) {
  const { connected, onlineUsers } = useSocket(token, { onUnauthorized });
  return (
    <div>
      <span>{connected ? 'connected' : 'offline'}</span>
      <span>{onlineUsers.length}</span>
    </div>
  );
}

beforeEach(() => {
  io.mockClear();
  mockSocket.disconnect.mockClear();
  mockSocket.handlers = {};
});

test('opens a socket with the jwt and closes it on unmount', () => {
  const view = render(<Probe token="jwt-1" />);
  expect(io).toHaveBeenCalledWith(expect.objectContaining({ auth: { token: 'jwt-1' } }));
  expect(screen.getByText('offline')).toBeInTheDocument();

  act(() => {
    mockSocket.handlers['presence:update']({ onlineUsers: [{ id: '1', username: 'alice' }] });
  });
  expect(screen.getByText('connected')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();

  view.unmount();
  expect(mockSocket.disconnect).toHaveBeenCalled();
});

test('does not connect without a token', () => {
  render(<Probe token={null} />);
  expect(io).not.toHaveBeenCalled();
});

test('drops the session when the handshake is rejected', () => {
  const onUnauthorized = jest.fn();
  render(<Probe token="expired" onUnauthorized={onUnauthorized} />);
  act(() => {
    mockSocket.handlers.connect_error({ message: 'Authentication required' });
  });
  expect(onUnauthorized).toHaveBeenCalled();
  expect(mockSocket.disconnect).toHaveBeenCalled();
});
