const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function startMemoryDb() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  return mongod;
}

async function clearCollections() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function stopMemoryDb(mongod) {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

function register(app, overrides = {}) {
  return request(app).post('/api/auth/register').send({
    username: 'alice',
    email: 'alice@example.com',
    password: 'password123',
    displayName: 'Alice',
    ...overrides,
  });
}

module.exports = { startMemoryDb, clearCollections, stopMemoryDb, register };
