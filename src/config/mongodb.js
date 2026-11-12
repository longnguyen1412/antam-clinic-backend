import { MongoClient } from 'mongodb';
import { env } from './env.js';

let client = null;
let db = null;
let isConnected = false;

/**
 * Connect to MongoDB and initialize collections & indexes
 */
export async function connectMongo() {
  try {
    if (isConnected && db) return db;

    client = new MongoClient(env.mongo.uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(env.mongo.dbName);
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to database: ${env.mongo.dbName}`);

    // Create Indexes in background
    await initMongoIndexes(db).catch((idxErr) => {
      console.warn('[MongoDB] Index creation warning:', idxErr.message);
    });

    return db;
  } catch (err) {
    isConnected = false;
    db = null;
    console.warn(`[MongoDB] Could not connect to MongoDB (${env.mongo.uri}): ${err.message}. Main application continues running.`);
    return null;
  }
}

/**
 * Ensure optimal indexes for fast analytics queries
 */
async function initMongoIndexes(database) {
  // 1. Indexes for api_logs
  const apiLogs = database.collection('api_logs');
  await apiLogs.createIndex({ timestamp: -1 });
  await apiLogs.createIndex({ statusCode: 1 });
  await apiLogs.createIndex({ isError: 1 });
  await apiLogs.createIndex({ route: 1 });
  await apiLogs.createIndex({ durationMs: -1 });

  // 2. Indexes for invoice_replicas
  const invoices = database.collection('invoice_replicas');
  await invoices.createIndex({ maHD: 1 }, { unique: true });
  await invoices.createIndex({ ngayLap: -1 });
  await invoices.createIndex({ site: 1 });
  await invoices.createIndex({ trangThai: 1 });
  await invoices.createIndex({ maBN: 1 });
}

export function getMongoDb() {
  return db;
}

export function isMongoConnected() {
  return isConnected;
}

export async function closeMongo() {
  if (client) {
    try {
      await client.close();
      isConnected = false;
      db = null;
      console.log('[MongoDB] Connection closed.');
    } catch (err) {
      console.error('[MongoDB] Error closing connection:', err.message);
    }
  }
}

