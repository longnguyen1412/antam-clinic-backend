import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  siteCode: (process.env.SITE_CODE || 'S1').toUpperCase(),
  siteName: process.env.SITE_NAME || 'Chi nhánh Cầu Giấy',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5431', 10),
    database: process.env.DB_NAME || 'ql_phongkham_cn1',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'password123',
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT_MS || '5000', 10),
  },
};
