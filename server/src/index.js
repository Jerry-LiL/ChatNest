const config = require('./config');
const { connectDb } = require('./db');
const { ensureGeneralChannel } = require('./services/channels');
const { createHttpServer } = require('./http');

async function main() {
  config.assertRuntimeConfig();
  await connectDb();
  await ensureGeneralChannel();
  const { server } = createHttpServer();
  server.listen(config.port, () => {
    console.log(`ChatNest API listening on ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
