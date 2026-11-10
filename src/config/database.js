import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const pools = {
  S0: new Pool({ ...env.db.s0, ...poolConfig }),
  S1: new Pool({ ...env.db.s1, ...poolConfig }),
  S2: new Pool({ ...env.db.s2, ...poolConfig }),
  S3: new Pool({ ...env.db.s3, ...poolConfig }),
};

// Error logging on idle client errors
Object.entries(pools).forEach(([site, pool]) => {
  pool.on('error', (err) => {
    console.error(`[DB Pool Error] Site ${site}:`, err.message);
  });
});

/**
 * Get DB Pool for a given site (S0, S1, S2, S3)
 * @param {string} siteCode
 * @returns {pg.Pool}
 */
export function getPool(siteCode) {
  const normalized = (siteCode || env.defaultSite).toUpperCase();
  const pool = pools[normalized];
  if (!pool) {
    throw new Error(`Site database pool '${siteCode}' not found. Supported sites: S0, S1, S2, S3`);
  }
  return pool;
}

/**
 * Execute a query against a specific site
 * @param {string} siteCode
 * @param {string} text
 * @param {Array<any>} params
 */
export async function querySite(siteCode, text, params = []) {
  const pool = getPool(siteCode);
  return pool.query(text, params);
}

/**
 * Test connections to all configured sites
 */
export async function checkConnections() {
  const results = {};
  for (const [site, pool] of Object.entries(pools)) {
    try {
      const res = await pool.query('SELECT current_database() AS db, NOW() AS now, current_user AS user');
      results[site] = {
        status: 'UP',
        database: res.rows[0].db,
        user: res.rows[0].user,
        timestamp: res.rows[0].now,
      };
    } catch (err) {
      results[site] = {
        status: 'DOWN',
        error: err.message,
      };
    }
  }
  return results;
}

/**
 * Gracefully close all DB pools
 */
export async function closeAllPools() {
  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}
