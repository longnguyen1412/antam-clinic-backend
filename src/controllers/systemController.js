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

const ALL_SITES = [
  {
    site: 'S0',
    role: 'HUB',
    name: 'Trung tâm',
    maCn: null,
    dockerHost: process.env.DB_HOST_S0 || 'site_s0_trungtam',
    dockerPort: parseInt(process.env.DB_PORT_S0 || '5432', 10),
    localHost: process.env.DB_HOST_S0 || 'localhost',
    localPort: parseInt(process.env.DB_PORT_S0 || '5430', 10),
    dbName: 'ql_phongkham_hub',
    fdwSchema: null,
  },
  {
    site: 'S1',
    role: 'BRANCH',
    name: 'Cầu Giấy',
    maCn: 'CN1',
    dockerHost: process.env.DB_HOST_S1 || 'site_s1_caugiay',
    dockerPort: parseInt(process.env.DB_PORT_S1 || '5432', 10),
    localHost: process.env.DB_HOST_S1 || 'localhost',
    localPort: parseInt(process.env.DB_PORT_S1 || '5431', 10),
    dbName: 'ql_phongkham_cn1',
    fdwSchema: 's1',
  },
  {
    site: 'S2',
    role: 'BRANCH',
    name: 'Đống Đa',
    maCn: 'CN2',
    dockerHost: process.env.DB_HOST_S2 || 'site_s2_dongda',
    dockerPort: parseInt(process.env.DB_PORT_S2 || '5432', 10),
    localHost: process.env.DB_HOST_S2 || 'localhost',
    localPort: parseInt(process.env.DB_PORT_S2 || '5432', 10),
    dbName: 'ql_phongkham_cn2',
    fdwSchema: 's2',
  },
  {
    site: 'S3',
    role: 'BRANCH',
    name: 'Ba Đình',
    maCn: 'CN3',
    dockerHost: process.env.DB_HOST_S3 || 'site_s3_badinh',
    dockerPort: parseInt(process.env.DB_PORT_S3 || '5432', 10),
    localHost: process.env.DB_HOST_S3 || 'localhost',
    localPort: parseInt(process.env.DB_PORT_S3 || '5433', 10),
    dbName: 'ql_phongkham_cn3',
    fdwSchema: 's3',
  },
];

async function checkSiteEndpoint(cfg, isDocker) {
  const primary = isDocker
    ? { host: cfg.dockerHost, port: cfg.dockerPort }
    : { host: cfg.localHost, port: cfg.localPort };
  const fallback = isDocker
    ? { host: cfg.localHost, port: cfg.localPort }
    : { host: cfg.dockerHost, port: cfg.dockerPort };

  const t0 = Date.now();
  let ok = await checkPort(primary.host, primary.port, 1000);
  let latency = Date.now() - t0;
  let usedHost = primary.host;
  let usedPort = primary.port;

  if (!ok && (fallback.host !== primary.host || fallback.port !== primary.port)) {
    const tFall0 = Date.now();
    const fallOk = await checkPort(fallback.host, fallback.port, 1000);
    if (fallOk) {
      ok = true;
      latency = Date.now() - tFall0;
      usedHost = fallback.host;
      usedPort = fallback.port;
    }
  }

  return { ok, latency: ok ? latency : null, host: usedHost, port: usedPort };
}

export async function getAppMode(req, res) {
  res.json({
    mode: env.siteCode === 'S0' ? 'HQ' : 'BRANCH',
    localSite: env.siteCode === 'S0' ? null : env.siteCode,
    hubSite: 'S0',
    branchSites: env.siteCode === 'S0' ? ['S1', 'S2', 'S3'] : [env.siteCode],
  });
}

export async function getSiteStatus(req, res) {
  const isDocker = Boolean(
    process.env.DOCKER_CONTAINER ||
    (env.db.host && !['localhost', '127.0.0.1'].includes(env.db.host))
  );

  // Quy định hiển thị:
  // - Site trung tâm (S0): thấy cả 4 site
  // - Site chi nhánh: chỉ thấy chi nhánh mình và site trung tâm
  let targetSites;
  if (env.siteCode === 'S0') {
    targetSites = ALL_SITES;
  } else {
    const hub = ALL_SITES.find((s) => s.site === 'S0');
    const myBranch = ALL_SITES.find((s) => s.site === env.siteCode);
    targetSites = [hub, myBranch].filter(Boolean);
  }

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
    targetSites.map(async (cfg) => {
      const isCurrent = cfg.site === env.siteCode;

      if (isCurrent) {
        const host = env.db.host;
        const port = env.db.port;
        const jdbcUrl = `jdbc:postgresql://${host}:${port}/${currentDbName}`;
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

      // Với các trạm khác, kiểm tra kết nối TCP
      const check = await checkSiteEndpoint(cfg, isDocker);
      const jdbcUrl = `jdbc:postgresql://${check.host}:${check.port}/${cfg.dbName}`;

      let counts = null;
      // Nếu đang đứng ở S0 và trạm đích có schema FDW (s1, s2, s3), truy vấn đếm số lượng qua FDW
      if (env.siteCode === 'S0' && cfg.fdwSchema && check.ok) {
        try {
          const fc = await query(`
            SELECT 
              (SELECT count(*)::int FROM ${cfg.fdwSchema}.nhan_vien) as "Nhân viên",
              (SELECT count(*)::int FROM ${cfg.fdwSchema}.benh_nhan) as "Bệnh nhân",
              (SELECT count(*)::int FROM ${cfg.fdwSchema}.phieu_kham) as "Phiếu khám",
              (SELECT count(*)::int FROM ${cfg.fdwSchema}.phieu_dieu_tri) as "Phiếu điều trị"
          `);
          counts = fc.rows[0] || null;
        } catch {
          // Bỏ qua nếu FDW tạm gián đoạn, vẫn giữ up = true
        }
      }

      return {
        site: cfg.site,
        role: cfg.role,
        name: cfg.name,
        maCn: cfg.maCn,
        jdbcUrl,
        up: check.ok,
        latencyMs: check.latency,
        database: cfg.dbName,
        counts,
        error: check.ok ? null : `Không kết nối được tới cổng ${check.port} (${check.host})`,
      };
    })
  );

  res.json(results);
}
