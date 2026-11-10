import { query } from '../config/database.js';

export async function getBacSiToanChuoi(req, res, next) {
  try {
    const { q, khoa } = req.query;
    let sql = `
      SELECT nv.manv, nv.hoten, nv.ngaysinh, nv.gioitinh, nv.cccd, nv.diachi,
             nv.hesoluong, nv.ngayvaolam, nv.trangthai, nv.makhoa,
             k.tenkhoa, k.macn,
             bs.chuyenkhoa, bs.hocvi, bs.sochungchihanhnghe,
             COALESCE(
               (SELECT array_agg(sodienthoai) FROM nv_sodienthoai WHERE manv = nv.manv),
               ARRAY[]::varchar[]
             ) AS sodienthoai,
             0 AS soluot
      FROM nhan_vien nv
      JOIN bac_si bs ON bs.manv = nv.manv
      JOIN khoa k ON k.makhoa = nv.makhoa
      WHERE 1=1
    `;
    const params = [];
    if (khoa) {
      params.push(khoa);
      sql += ` AND nv.makhoa = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (nv.hoten ILIKE $${params.length} OR nv.manv ILIKE $${params.length})`;
    }
    sql += ` ORDER BY nv.manv`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maNV: r.manv,
      hoTen: r.hoten,
      ngaySinh: r.ngaysinh ? r.ngaysinh.toISOString().split('T')[0] : null,
      gioiTinh: r.gioitinh,
      cccd: r.cccd,
      diaChi: r.diachi,
      heSoLuong: parseFloat(r.hesoluong),
      ngayVaoLam: r.ngayvaolam ? r.ngayvaolam.toISOString().split('T')[0] : null,
      trangThai: r.trangthai,
      maKhoa: r.makhoa,
      tenKhoa: r.tenkhoa,
      chuyenKhoa: r.chuyenkhoa,
      hocVi: r.hocvi,
      soChungChiHanhNghe: r.sochungchihanhnghe,
      soDienThoai: r.sodienthoai || [],
      soLuot: r.soluot,
      maCn: r.macn,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getYTaToanChuoi(req, res, next) {
  try {
    const { q, khoa } = req.query;
    let sql = `
      SELECT nv.manv, nv.hoten, nv.ngaysinh, nv.gioitinh, nv.cccd, nv.diachi,
             nv.hesoluong, nv.ngayvaolam, nv.trangthai, nv.makhoa,
             k.tenkhoa, k.macn,
             yt.trinhdo, yt.sochungchihanhnghe,
             COALESCE(
               (SELECT array_agg(sodienthoai) FROM nv_sodienthoai WHERE manv = nv.manv),
               ARRAY[]::varchar[]
             ) AS sodienthoai,
             0 AS solanhotro
      FROM nhan_vien nv
      JOIN y_ta yt ON yt.manv = nv.manv
      JOIN khoa k ON k.makhoa = nv.makhoa
      WHERE 1=1
    `;
    const params = [];
    if (khoa) {
      params.push(khoa);
      sql += ` AND nv.makhoa = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (nv.hoten ILIKE $${params.length} OR nv.manv ILIKE $${params.length})`;
    }
    sql += ` ORDER BY nv.manv`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maNV: r.manv,
      hoTen: r.hoten,
      ngaySinh: r.ngaysinh ? r.ngaysinh.toISOString().split('T')[0] : null,
      gioiTinh: r.gioitinh,
      cccd: r.cccd,
      diaChi: r.diachi,
      heSoLuong: parseFloat(r.hesoluong),
      ngayVaoLam: r.ngayvaolam ? r.ngayvaolam.toISOString().split('T')[0] : null,
      trangThai: r.trangthai,
      maKhoa: r.makhoa,
      tenKhoa: r.tenkhoa,
      trinhDo: r.trinhdo,
      soChungChiHanhNghe: r.sochungchihanhnghe,
      soDienThoai: r.sodienthoai || [],
      soLanHoTro: r.solanhotro,
      maCn: r.macn,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getKhoaToanChuoi(req, res, next) {
  try {
    const result = await query(
      `SELECT k.makhoa, k.tenkhoa, k.mota, k.macn,
              COUNT(DISTINCT nv.manv)::int AS sonhanvien,
              0 AS soluot
       FROM khoa k
       LEFT JOIN nhan_vien nv ON nv.makhoa = k.makhoa
       GROUP BY k.makhoa, k.tenkhoa, k.mota, k.macn
       ORDER BY k.makhoa`
    );
    res.json(
      result.rows.map((r) => ({
        maKhoa: r.makhoa,
        tenKhoa: r.tenkhoa,
        moTa: r.mota,
        maCn: r.macn,
        soNhanVien: r.sonhanvien,
        soLuot: r.soluot,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getThietBiToanChuoi(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `SELECT matb, tentb, loaitb, dongiasudung, ngaymua, tinhtrang, macn, 0 AS solansudung FROM thiet_bi WHERE 1=1`;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (tentb ILIKE $1 OR matb ILIKE $1)`;
    }
    sql += ` ORDER BY matb`;

    const result = await query(sql, params);
    res.json(
      result.rows.map((r) => ({
        maTB: r.matb,
        tenTB: r.tentb,
        loaiTB: r.loaitb,
        donGiaSuDung: parseFloat(r.dongiasudung),
        ngayMua: r.ngaymua ? r.ngaymua.toISOString().split('T')[0] : null,
        tinhTrang: r.tinhtrang,
        maCn: r.macn,
        soLanSuDung: r.solansudung,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getBenhNhanToanChuoiHq(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `SELECT DISTINCT mabn, hoten, ngaysinh, gioitinh, cccd, sodienthoai FROM benh_nhan WHERE 1=1`;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (hoten ILIKE $1 OR mabn ILIKE $1 OR cccd ILIKE $1 OR sodienthoai ILIKE $1)`;
    }
    sql += ` ORDER BY mabn DESC LIMIT 200`;

    const result = await query(sql, params);
    res.json(
      result.rows.map((r) => ({
        maBN: r.mabn,
        hoTen: r.hoten,
        ngaySinh: r.ngaysinh ? r.ngaysinh.toISOString().split('T')[0] : null,
        gioiTinh: r.gioitinh,
        cccd: r.cccd,
        soDienThoai: r.sodienthoai,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getChiNhanhCoHoSo(req, res, next) {
  try {
    const { ma } = req.query;
    if (!ma) return res.json({});
    const maList = ma.split(',').map((s) => s.trim()).filter(Boolean);

    const result = await query(
      `SELECT DISTINCT mabn, macn FROM (
         SELECT pk.mabn, k.macn 
         FROM phieu_kham pk 
         JOIN nhan_vien nv ON nv.manv = pk.mabs 
         JOIN khoa k ON k.makhoa = nv.makhoa
         WHERE pk.mabn = ANY($1)
       ) sub`,
      [maList]
    ).catch(() => ({ rows: [] }));

    const map = {};
    maList.forEach((m) => { map[m] = []; });
    result.rows.forEach((r) => {
      if (!map[r.mabn]) map[r.mabn] = [];
      if (!map[r.mabn].includes(r.macn)) map[r.mabn].push(r.macn);
    });

    res.json(map);
  } catch (err) {
    next(err);
  }
}

export async function getDoanhThuToanChuoi(req, res, next) {
  try {
    const { tu, den } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = tu || `${today.slice(0, 7)}-01`;
    const toDate = den || today;

    const result = await query(
      `SELECT k.macn, cn.tencn, COUNT(DISTINCT cp.maphieu)::int AS soluot,
              COALESCE(SUM(cp.tiendichvu), 0) AS tiendichvu,
              COALESCE(SUM(cp.tienthuoc), 0) AS tienthuoc,
              COALESCE(SUM(cp.tienthietbi), 0) AS tienthietbi,
              COALESCE(SUM(cp.tongtien), 0) AS tongdoanhthu
       FROM v_chi_phi_phieu cp
       JOIN nhan_vien nv ON nv.manv = cp.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       JOIN chi_nhanh cn ON cn.macn = k.macn
       WHERE cp.thoigian::date >= $1 AND cp.thoigian::date <= $2
       GROUP BY k.macn, cn.tencn
       ORDER BY k.macn`,
      [fromDate, toDate]
    );

    const theoChiNhanh = result.rows.map((r) => ({
      maCn: r.macn,
      tenCn: r.tencn,
      soLuot: r.soluot,
      tienDichVu: parseFloat(r.tiendichvu),
      tienThuoc: parseFloat(r.tienthuoc),
      tienThietBi: parseFloat(r.tienthietbi),
      tongDoanhThu: parseFloat(r.tongdoanhthu),
    }));

    const tong = theoChiNhanh.reduce(
      (acc, c) => ({
        soLuot: acc.soLuot + c.soLuot,
        tienDichVu: acc.tienDichVu + c.tienDichVu,
        tienThuoc: acc.tienThuoc + c.tienThuoc,
        tienThietBi: acc.tienThietBi + c.tienThietBi,
        tongDoanhThu: acc.tongDoanhThu + c.tongDoanhThu,
      }),
      { soLuot: 0, tienDichVu: 0, tienThuoc: 0, tienThietBi: 0, tongDoanhThu: 0 }
    );

    res.json({
      tuNgay: fromDate,
      denNgay: toDate,
      tongCong: tong,
      theoChiNhanh,
    });
  } catch (err) {
    next(err);
  }
}

export async function getThongKeBenhToanChuoi(req, res, next) {
  try {
    const { thang } = req.query;
    const targetMonth = thang || new Date().toISOString().slice(0, 7);

    const sql = `
      SELECT b.mabenh, b.tenbenh, b.maicd10, COUNT(DISTINCT d.madot)::int AS solanmac
      FROM dot_dieu_tri d
      JOIN benh b ON b.mabenh = d.mabenh
      JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
      WHERE TO_CHAR(pk.thoigian, 'YYYY-MM') = $1
         OR EXISTS (
           SELECT 1 FROM phieu_dieu_tri pdt 
           WHERE pdt.madot = d.madot AND TO_CHAR(pdt.thoigian, 'YYYY-MM') = $1
         )
      GROUP BY b.mabenh, b.tenbenh, b.maicd10
      ORDER BY solanmac DESC, b.mabenh ASC
    `;

    const result = await query(sql, [targetMonth]);
    const tongSoLuot = result.rows.reduce((sum, r) => sum + r.solanmac, 0);

    res.json({
      thang: targetMonth,
      tongSoLuot,
      danhSach: result.rows.map((r) => ({
        maBenh: r.mabenh,
        tenBenh: r.tenbenh,
        maICD10: r.maicd10,
        soLanMac: r.solanmac,
      })),
    });
  } catch (err) {
    next(err);
  }
}
