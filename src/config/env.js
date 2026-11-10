import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  defaultSite: (process.env.DEFAULT_SITE || 'S1').toUpperCase(),
  db: {
    s0: {
      host: process.env.DB_S0_HOST || 'localhost',
      port: parseInt(process.env.DB_S0_PORT || '5430', 10),
      database: process.env.DB_S0_NAME || 'ql_phongkham_hub',
      user: process.env.DB_S0_USER || 'admin',
      password: process.env.DB_S0_PASS || 'password123',
    },
    s1: {
      host: process.env.DB_S1_HOST || 'localhost',
      port: parseInt(process.env.DB_S1_PORT || '5431', 10),
      database: process.env.DB_S1_NAME || 'ql_phongkham_cn1',
      user: process.env.DB_S1_USER || 'admin',
      password: process.env.DB_S1_PASS || 'password123',
    },
    s2: {
      host: process.env.DB_S2_HOST || 'localhost',
      port: parseInt(process.env.DB_S2_PORT || '5432', 10),
      database: process.env.DB_S2_NAME || 'ql_phongkham_cn2',
      user: process.env.DB_S2_USER || 'admin',
      password: process.env.DB_S2_PASS || 'password123',
    },
    s3: {
      host: process.env.DB_S3_HOST || 'localhost',
      port: parseInt(process.env.DB_S3_PORT || '5433', 10),
      database: process.env.DB_S3_NAME || 'ql_phongkham_cn3',
      user: process.env.DB_S3_USER || 'admin',
      password: process.env.DB_S3_PASS || 'password123',
    },
  },
};
