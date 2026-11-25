import { fireEvent, render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';

const messages = [
  {
    id: '1',
    content: 'older note',
    createdAt: '2024-06-01T12:00:00.000Z',
    sender: { id: 'a', username: 'alice', displayName: 'Alice Sharma' },
  },
  {
    id: '2',
    content: 'newer note',
    createdAt: '2024-06-01T12:01:00.000Z',
    sender: { id: 'b', username: 'bob', displayName: 'Bob Mehta' },
  },
];

function scroller() {
  const list = screen.getByTestId('message-list');
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 800 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 });
  return list;
}

test('loads older messages when the list is scrolled to the top', () => {
  const onLoadOlder = jest.fn();
  render(
    <MessageList messages={messages} hasMore loadingOlder={false} onLoadOlder={onLoadOlder} />,
  );
  expect(screen.getByText('Alice Sharma')).toBeInTheDocument();
  const list = scroller();
  list.scrollTop = 0;
  fireEvent.scroll(list);
  expect(onLoadOlder).toHaveBeenCalledTimes(1);
});

test('does not ask for more when this is the last page', () => {
  const onLoadOlder = jest.fn();
  render(
    <MessageList messages={messages} hasMore={false} loadingOlder={false} onLoadOlder={onLoadOlder} />,
  );
  const list = scroller();
  list.scrollTop = 0;
  fireEvent.scroll(list);
  expect(onLoadOlder).not.toHaveBeenCalled();
});
