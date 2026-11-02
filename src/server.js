const env = require('./config/env');
const { connectDb } = require('./config/db');
const app = require('./app');

async function start() {
  await connectDb();
  const server = app.listen(env.port, () => {
    console.log(`CreditSea API listening on :${env.port} (demoMode=${env.demoMode})`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
