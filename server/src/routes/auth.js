const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const HttpError = require('../errors');
const { wrap } = require('../utils/async');
const { validateRegistration, validateLogin } = require('../validation');
const { signToken, requireAuth } = require('../middleware/auth');
const { joinGeneral } = require('../services/channels');
const { serializeUser } = require('../utils/serialize');

const router = express.Router();

router.post('/register', wrap(async (req, res) => {
  const { username, email, password, displayName } = validateRegistration(req.body || {});
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) throw new HttpError(409, 'Email or username already in use');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, passwordHash, displayName });
  await joinGeneral(user._id);
  res.status(201).json({
    token: signToken(user),
    user: serializeUser(user, { includeEmail: true }),
  });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = validateLogin(req.body || {});
  const user = await User.findOne({ email });
  const matches = user && await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new HttpError(401, 'Invalid email or password');
  res.json({
    token: signToken(user),
    user: serializeUser(user, { includeEmail: true }),
  });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Authentication required');
  res.json({ user: serializeUser(user, { includeEmail: true }) });
}));

module.exports = router;
