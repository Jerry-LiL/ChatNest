import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { api } from '../api';
import { LoginPage } from './LoginPage';

jest.mock('../api', () => ({
  api: {
    login: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
  },
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
    user: { id: '1', username: 'alice', displayName: 'Alice', email: 'alice@example.com' },
  });
});

test('signs in and stores the token', async () => {
  const user = userEvent.setup();
  api.login.mockResolvedValue({
    token: 'jwt-1',
    user: { id: '1', username: 'alice', displayName: 'Alice', email: 'alice@example.com' },
  });
  renderLogin();
  await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText('Workspace')).toBeInTheDocument();
  expect(localStorage.getItem('chatnest_token')).toBe('jwt-1');
  expect(api.login).toHaveBeenCalledWith({
    email: 'alice@example.com',
    password: 'password123',
  });
});

test('shows the server error when the password is wrong', async () => {
  const user = userEvent.setup();
  api.login.mockRejectedValue(new Error('Invalid email or password'));
  renderLogin();
  await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'wrongpass1');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
});
