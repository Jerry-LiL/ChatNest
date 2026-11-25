const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { registerSockets } = require('./sockets');

function createHttpServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  registerSockets(io);
  app.set('io', io);
  return { app, server, io };
}

module.exports = { createHttpServer };
