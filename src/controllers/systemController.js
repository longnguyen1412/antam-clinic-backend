import { env } from '../config/env.js';
import { query } from '../config/database.js';

export async function getAppMode(req, res) {
  res.json({
    mode: env.siteCode === 'S0' ? 'HQ' : 'BRANCH',
    localSite: env.siteCode === 'S0' ? null : env.siteCode,
    hubSite: 'S0',
    branchSites: ['S1', 'S2', 'S3'],
  });
}

export async function getSiteStatus(req, res) {
  try {
    const branchesResult = await query('SELECT macn, tencn FROM chi_nhanh ORDER BY macn');
    const branches = branchesResult.rows;

    const sites = [
      {
        site: 'S0',
        role: 'HUB',
        name: 'Trung tâm',
        url: 'http://localhost:5430',
        reachable: true,
      },
      ...branches.map((b) => {
        const siteId = b.macn === 'CN1' ? 'S1' : b.macn === 'CN2' ? 'S2' : 'S3';
        return {
          site: siteId,
          role: 'BRANCH',
          name: b.tencn.replace('Phòng khám Đa khoa ', ''),
          url: `http://localhost:${5430 + parseInt(b.macn.replace('CN', ''), 10)}`,
          reachable: true,
        };
      }),
    ];

    res.json(sites);
  } catch (err) {
    res.json([
      { site: 'S0', role: 'HUB', name: 'Trung tâm', url: 'http://localhost:5430', reachable: true },
      { site: 'S1', role: 'BRANCH', name: 'Cầu Giấy', url: 'http://localhost:5431', reachable: true },
      { site: 'S2', role: 'BRANCH', name: 'Đống Đa', url: 'http://localhost:5432', reachable: true },
      { site: 'S3', role: 'BRANCH', name: 'Ba Đình', url: 'http://localhost:5433', reachable: true },
    ]);
  }
}
