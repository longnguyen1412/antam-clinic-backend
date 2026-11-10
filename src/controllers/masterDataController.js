import { query } from '../config/database.js';

export async function getBranches(req, res, next) {
  try {
    const result = await query('SELECT * FROM chi_nhanh ORDER BY macn ASC');
    res.json({
      status: 200,
      site: req.site,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMedicines(req, res, next) {
  try {
    const result = await query('SELECT * FROM thuoc ORDER BY tenthuoc ASC LIMIT 100');
    res.json({
      status: 200,
      site: req.site,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function getServices(req, res, next) {
  try {
    const result = await query('SELECT * FROM dich_vu ORDER BY tendv ASC');
    res.json({
      status: 200,
      site: req.site,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}
