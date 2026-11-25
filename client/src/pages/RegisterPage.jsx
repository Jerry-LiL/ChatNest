import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from './AuthLayout';

const USERNAME = /^[a-z0-9_]{3,20}$/;

export function RegisterPage() {
  const { user, register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const handle = username.trim().toLowerCase();
    if (!USERNAME.test(handle)) {
      setError('Username must be 3-20 characters and use letters, numbers, or underscores');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError('Password must be 8-72 characters');
      return;
    }
    setPending(true);
    try {
      await register({
        username: handle,
        email,
        password,
        displayName: displayName.trim() || handle,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="You will land in #general with the rest of the workspace."
      footer={<Link to="/login">Sign in</Link>}
    >
      <form className="stack-form" onSubmit={handleSubmit}>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={displayName}
          autoComplete="name"
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
