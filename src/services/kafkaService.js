import { Kafka, logLevel } from 'kafkajs';
import { env } from '../config/env.js';
import { getMongoDb, isMongoConnected } from '../config/mongodb.js';

export const TOPICS = {
  API_LOGS: 'antam.api.logs',
  INVOICE_EVENTS: 'antam.invoice.events',
};

let kafka = null;
let producer = null;
let consumer = null;
let isKafkaReady = false;

/**
 * Initialize Kafka Producer and Consumer
 * @param {object} options
 * @param {boolean} [options.isConsumer=true] Whether to run the consumer worker (True at Central S0, False at Branches)
 */
export async function initKafka({ isConsumer = true } = {}) {
  try {
    kafka = new Kafka({
      clientId: `${env.kafka.clientId}-${env.siteCode.toLowerCase()}`,
      brokers: env.kafka.brokers,
      logLevel: logLevel.NOTHING, // Silent Kafka internal logs to keep console clean
      retry: {
        initialRetryTime: 300,
        retries: 3,
      },
    });

    // 1. Ensure topics exist (only Central S0 / Consumer creates them)
    if (isConsumer) {
      try {
        const admin = kafka.admin();
        await admin.connect();
        await admin.createTopics({
          topics: [
            { topic: TOPICS.API_LOGS, numPartitions: 1 },
            { topic: TOPICS.INVOICE_EVENTS, numPartitions: 1 },
          ],
        });
        await admin.disconnect();
      } catch (adminErr) {
        // Ignore if already exist
      }
    }

    // 2. Initialize Producer (all sites connect to central Kafka to publish events)
    producer = kafka.producer({
      allowAutoTopicCreation: true,
    });
    await producer.connect();
    isKafkaReady = true;
    console.log(`[Kafka] Producer connected to Central Kafka (${env.kafka.brokers.join(', ')}) from site ${env.siteCode}`);

    // 3. Initialize Consumer for background processing ONLY at Central Site (S0)
    if (isConsumer) {
      initKafkaConsumer().catch((err) => {
        console.warn('[Kafka] Consumer startup warning:', err.message);
      });
    } else {
      console.log(`[Kafka] Site ${env.siteCode} running in Producer-only mode (Events sent to Central Kafka).`);
    }

    return true;
  } catch (err) {
    isKafkaReady = false;
    producer = null;
    console.warn(`[Kafka] Could not connect to Kafka (${env.kafka.brokers.join(', ')}): ${err.message}. Non-blocking fallback enabled.`);
    return false;
  }
}

/**
 * Consumer worker subscribing to topics and syncing to MongoDB
 */
async function initKafkaConsumer() {
  if (!kafka) return;

  consumer = kafka.consumer({
    groupId: env.kafka.groupId,
  });

  await consumer.connect();
  console.log(`[Kafka] Consumer connected with groupId: ${env.kafka.groupId}`);

  await consumer.subscribe({ topic: TOPICS.API_LOGS, fromBeginning: false });
  await consumer.subscribe({ topic: TOPICS.INVOICE_EVENTS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const rawValue = message.value.toString();
        const payload = JSON.parse(rawValue);

        const db = getMongoDb();
        if (!db || !isMongoConnected()) {
          return; // Skip silently if MongoDB is momentarily not connected
        }

        if (topic === TOPICS.API_LOGS) {
          // 1. Save API Log to MongoDB
          const apiLogsColl = db.collection('api_logs');
          await apiLogsColl.insertOne({
            ...payload,
            timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            createdAt: new Date(),
          });
        } else if (topic === TOPICS.INVOICE_EVENTS) {
          // 2. Upsert Invoice Replica into MongoDB
          const invoiceColl = db.collection('invoice_replicas');
          await invoiceColl.updateOne(
            { maHD: payload.maHD },
            {
              $set: {
                ...payload,
                ngayLap: payload.ngayLap ? new Date(payload.ngayLap) : new Date(),
                updatedAt: new Date(),
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
        }
      } catch (procErr) {
        // Safe catch: an individual message failure never crashes the worker
        console.warn(`[Kafka Consumer Error] Failed to process message from ${topic}:`, procErr.message);
      }
    },
  });
}

/**
 * Safe, asynchronous, fire-and-forget event publisher.
 * NEVER blocks or throws errors back to the caller.
 */
export function publishEvent(topic, data) {
  // Execute in microtask / background
  setImmediate(async () => {
    try {
      if (!isKafkaReady || !producer) {
        // Fallback: If Kafka is not running, write directly to MongoDB if Mongo is connected!
        fallbackDirectMongoWrite(topic, data);
        return;
      }

      await producer.send({
        topic,
        messages: [
          {
            key: data.maHD || data.requestId || String(Date.now()),
            value: JSON.stringify(data),
          },
        ],
      });
    } catch (err) {
      // Kafka publish error caught safely
      console.warn(`[Kafka Producer Warning] Could not publish to ${topic}:`, err.message);
      fallbackDirectMongoWrite(topic, data);
    }
  });
}

/**
 * Fallback to direct MongoDB write if Kafka is unavailable
 */
async function fallbackDirectMongoWrite(topic, data) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return;

    if (topic === TOPICS.API_LOGS) {
      await db.collection('api_logs').insertOne({
        ...data,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        createdAt: new Date(),
      });
    } else if (topic === TOPICS.INVOICE_EVENTS) {
      await db.collection('invoice_replicas').updateOne(
        { maHD: data.maHD },
        {
          $set: {
            ...data,
            ngayLap: data.ngayLap ? new Date(data.ngayLap) : new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  } catch (directErr) {
    // Fail silently in background
  }
}

export function isKafkaConnected() {
  return isKafkaReady;
}

export async function closeKafka() {
  try {
    if (consumer) await consumer.disconnect();
    if (producer) await producer.disconnect();
    isKafkaReady = false;
    console.log('[Kafka] Producer and Consumer disconnected.');
  } catch (err) {
    console.error('[Kafka] Error closing Kafka connections:', err.message);
  }
}
