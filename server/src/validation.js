const HttpError = require('./errors');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9_]{3,20}$/;

function requireString(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, `${label} must be ${min}-${max} characters`);
  }
  return trimmed;
}

function validateRegistration(body) {
  const username = requireString(body.username, 'Username', { min: 3, max: 20 }).toLowerCase();
  if (!USERNAME.test(username)) {
    throw new HttpError(400, 'Username must be 3-20 characters and use letters, numbers, or underscores');
  }
  const email = requireString(body.email, 'Email', { min: 3, max: 120 }).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, 'Password must be 8-72 characters');
  }
  const displayName = body.displayName
    ? requireString(body.displayName, 'Display name', { min: 1, max: 40 })
    : username;
  return { username, email, password, displayName };
}

function validateLogin(body) {
  const email = requireString(body.email, 'Email', { min: 3, max: 120 }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw new HttpError(400, 'Password is required');
  return { email, password };
}

function slugifyChannelName(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (slug.length < 2) {
    throw new HttpError(400, 'Channel name must be at least 2 characters');
  }
  return slug;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  validateRegistration,
  validateLogin,
  slugifyChannelName,
  escapeRegex,
};
