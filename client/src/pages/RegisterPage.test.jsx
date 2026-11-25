import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { api } from '../api';
import { RegisterPage } from './RegisterPage';

jest.mock('../api', () => ({
  api: {
    login: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
  },
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>Workspace</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  api.me.mockResolvedValue({
    user: { id: '2', username: 'alice', displayName: 'Alice', email: 'alice@example.com' },
  });
});

test('stops a short password before calling the api', async () => {
  const user = userEvent.setup();
  renderRegister();
  await user.type(screen.getByLabelText(/display name/i), 'Alice');
  await user.type(screen.getByLabelText(/username/i), 'alice');
  await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'short');
  await user.click(screen.getByRole('button', { name: /create account/i }));
  expect(screen.getByRole('alert')).toHaveTextContent(/8-72/);
  expect(api.register).not.toHaveBeenCalled();
});

test('creates an account and stores the token', async () => {
  const user = userEvent.setup();
  api.register.mockResolvedValue({
    token: 'jwt-2',
    user: { id: '2', username: 'alice', displayName: 'Alice', email: 'alice@example.com' },
  });
  renderRegister();
  await user.type(screen.getByLabelText(/display name/i), 'Alice');
  await user.type(screen.getByLabelText(/username/i), 'alice');
  await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));
  expect(await screen.findByText('Workspace')).toBeInTheDocument();
  expect(localStorage.getItem('chatnest_token')).toBe('jwt-2');
});
