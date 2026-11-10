import net from 'net';
import { env } from '../config/env.js';
import { query } from '../config/database.js';

function checkPort(host, port, timeout = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

export async function getAppMode(req, res) {
  res.json({
    mode: env.siteCode === 'S0' ? 'HQ' : 'BRANCH',
    localSite: env.siteCode === 'S0' ? null : env.siteCode,
    hubSite: 'S0',
    branchSites: ['S1', 'S2', 'S3'],
  });
}

export async function getSiteStatus(req, res) {
  const siteConfigs = [
    { site: 'S0', role: 'HUB', name: 'Trung tâm', maCn: null, host: 'localhost', port: 5430, dbName: 'ql_phongkham_hub' },
    { site: 'S1', role: 'BRANCH', name: 'Cầu Giấy', maCn: 'CN1', host: 'localhost', port: 5431, dbName: 'ql_phongkham_cn1' },
    { site: 'S2', role: 'BRANCH', name: 'Đống Đa', maCn: 'CN2', host: 'localhost', port: 5432, dbName: 'ql_phongkham_cn2' },
    { site: 'S3', role: 'BRANCH', name: 'Ba Đình', maCn: 'CN3', host: 'localhost', port: 5433, dbName: 'ql_phongkham_cn3' },
  ];

  // Đo trạm hiện tại mà BE này kết nối
  let currentDbName = env.db.database;
  let currentLatency = 0;
  let currentCounts = null;
  let currentError = null;

  try {
    const t0 = Date.now();
    const dbCheck = await query('SELECT current_database() as db');
    currentLatency = Date.now() - t0;
    currentDbName = dbCheck.rows[0]?.db || env.db.database;

    if (env.siteCode === 'S0') {
      const c = await query(`
        SELECT 
          (SELECT count(*)::int FROM chi_nhanh) as "Chi nhánh",
          (SELECT count(*)::int FROM thuoc) as "Thuốc",
          (SELECT count(*)::int FROM benh) as "Bệnh",
          (SELECT count(*)::int FROM dich_vu) as "Dịch vụ"
      `);
      currentCounts = c.rows[0] || {};
    } else {
      const c = await query(`
        SELECT 
          (SELECT count(*)::int FROM nhan_vien) as "Nhân viên",
          (SELECT count(*)::int FROM benh_nhan) as "Bệnh nhân",
          (SELECT count(*)::int FROM phieu_kham) as "Phiếu khám",
          (SELECT count(*)::int FROM phieu_dieu_tri) as "Phiếu điều trị",
          (SELECT count(*)::int FROM thuoc) as "Thuốc (bản sao)"
      `);
      currentCounts = c.rows[0] || {};
    }
  } catch (err) {
    currentError = err.message;
  }

  const results = await Promise.all(
    siteConfigs.map(async (cfg) => {
      const jdbcUrl = `jdbc:postgresql://${cfg.host}:${cfg.port}/${cfg.dbName}`;
      const isCurrent = cfg.site === env.siteCode;

      if (isCurrent) {
        return {
          site: cfg.site,
          role: cfg.role,
          name: cfg.name,
          maCn: cfg.maCn,
          jdbcUrl,
          up: !currentError,
          latencyMs: currentLatency,
          database: currentDbName,
          counts: currentCounts,
          error: currentError,
        };
      }

      // Với các trạm khác, kiểm tra kết nối TCP nhanh tới cổng của trạm đó
      const t0 = Date.now();
      const isPortOpen = await checkPort(cfg.host, cfg.port);
      const pingTime = Date.now() - t0;

      return {
        site: cfg.site,
        role: cfg.role,
        name: cfg.name,
        maCn: cfg.maCn,
        jdbcUrl,
        up: isPortOpen,
        latencyMs: isPortOpen ? pingTime : null,
        database: cfg.dbName,
        counts: null,
        error: isPortOpen ? null : `Không kết nối được tới cổng ${cfg.port}`,
      };
    })
  );

  res.json(results);
}
