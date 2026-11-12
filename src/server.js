import app from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/database.js';
import { connectMongo, closeMongo } from './config/mongodb.js';
import { initKafka, closeKafka } from './services/kafkaService.js';

const server = app.listen(env.port, async () => {
  console.log(`===============================================`);
  console.log(` Antam Clinic Backend (ExpressJS) started!`);
  console.log(` Site: ${env.siteCode} - ${env.siteName}`);
  console.log(` Database: ${env.db.host}:${env.db.port}/${env.db.database}`);
  console.log(` Port: ${env.port}`);
  console.log(` Mode: ${env.nodeEnv}`);
  console.log(` Health check: http://localhost:${env.port}/api/health`);
  console.log(` Analytics: http://localhost:${env.port}/api/analytics/api-logs/overview`);
  console.log(` Master branches: http://localhost:${env.port}/api/master/chi-nhanh`);
  console.log(`===============================================`);

  // Central Site S0 vs Branch Sites (S1, S2, S3)
  const isHub = env.siteCode === 'S0' || process.env.ENABLE_ANALYTICS_CONSUMER === 'true';

  if (isHub) {
    // Site Trung tâm (S0): Khởi động MongoDB và Kafka Consumer để thu thập log & bản sao hóa đơn toàn chuỗi
    await connectMongo();
    await initKafka({ isConsumer: true });
    console.log('[Central S0] MongoDB & Kafka Consumer running for Central Analytics & Monitoring.');
  } else {
    // Site Chi nhánh (S1, S2, S3): Chỉ kết nối Kafka Producer để bắn log & hóa đơn về Kafka Trung tâm
    await initKafka({ isConsumer: false });
    console.log(`[Branch ${env.siteCode}] Kafka Producer connected to Central Kafka (No local MongoDB needed).`);
  }
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
      await closeKafka();
      await closeMongo();
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
