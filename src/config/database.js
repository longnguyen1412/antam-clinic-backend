import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool(env.db);

pool.on('error', (err) => {
  console.error(`[DB Pool Error] Site ${env.siteCode}:`, err.message);
});

/**
 * Execute a single query against the local database
 * @param {string} text SQL query
 * @param {Array<any>} params Parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Get a dedicated client from the pool (must release after use)
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Execute operations within a database transaction
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Error during transaction rollback:', rbErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Test connectivity to the local database
 */
export async function checkConnection() {
  try {
    const res = await pool.query(
      'SELECT current_database() AS db, NOW() AS now, current_user AS user, version() AS version'
    );
    return {
      status: 'UP',
      site: env.siteCode,
      siteName: env.siteName,
      database: res.rows[0].db,
      user: res.rows[0].user,
      timestamp: res.rows[0].now,
      version: res.rows[0].version.split(' ')[0] + ' ' + res.rows[0].version.split(' ')[1],
    };
  } catch (err) {
    return {
      status: 'DOWN',
      site: env.siteCode,
      siteName: env.siteName,
      database: env.db.database,
      error: err.message,
    };
  }
}

/**
 * Gracefully close the database pool
 */
export async function closePool() {
  await pool.end();
}
