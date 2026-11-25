const express = require('express');
const User = require('../models/User');
const { wrap } = require('../utils/async');
const { requireAuth } = require('../middleware/auth');
const { escapeRegex } = require('../validation');
const { serializeUser } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const filter = { _id: { $ne: req.userId } };
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ username: pattern }, { displayName: pattern }];
  }
  const users = await User.find(filter)
    .select('username displayName')
    .sort({ displayName: 1 })
    .limit(50);
  res.json({ users: users.map((user) => serializeUser(user)) });
}));

module.exports = router;
