const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const HttpError = require('../errors');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

async function verifySocketUser(token) {
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Authentication required');
  }
  const user = await User.findById(payload.sub).select('username displayName');
  if (!user) throw new HttpError(401, 'Authentication required');
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
  };
}

module.exports = { signToken, requireAuth, verifySocketUser };
