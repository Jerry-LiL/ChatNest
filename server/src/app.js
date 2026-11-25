const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const conversationRoutes = require('./routes/conversations');
const userRoutes = require('./routes/users');
const { errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/users', userRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
