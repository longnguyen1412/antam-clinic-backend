import app from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/database.js';

const server = app.listen(env.port, () => {
  console.log(`===============================================`);
  console.log(` Antam Clinic Backend (ExpressJS) started!`);
  console.log(` Site: ${env.siteCode} - ${env.siteName}`);
  console.log(` Database: ${env.db.host}:${env.db.port}/${env.db.database}`);
  console.log(` Port: ${env.port}`);
  console.log(` Mode: ${env.nodeEnv}`);
  console.log(` Health check: http://localhost:${env.port}/api/health`);
  console.log(` Master branches: http://localhost:${env.port}/api/master/chi-nhanh`);
  console.log(`===============================================`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await closePool();
      console.log('PostgreSQL connection pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
