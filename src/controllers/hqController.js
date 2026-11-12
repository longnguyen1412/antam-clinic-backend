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
    const tuTimestamp = `${fromDate} 00:00:00`;
    const denTimestamp = `${toDate} 23:59:59`;

    // 1. Danh sách chi nhánh
    const cnRes = await query(`SELECT macn, tencn FROM chi_nhanh ORDER BY macn`);
    const branches = cnRes.rows;

    // 2. Doanh thu phân bổ theo chi nhánh và theo từng tháng
    const thangCnSql = `
      SELECT k.macn, cn.tencn, TO_CHAR(cp.thoigian, 'YYYY-MM') AS thang,
             COUNT(DISTINCT cp.maphieu)::int AS soluot,
             COALESCE(SUM(CASE WHEN dv.loaidv IN ('Khám bệnh', 'Khám') THEN ct.thanhtien ELSE 0 END), 0)::float AS tienkham,
             COALESCE(SUM(CASE WHEN ct.loaichiphi = 'DV' AND (dv.loaidv NOT IN ('Khám bệnh', 'Khám') OR dv.loaidv IS NULL) THEN ct.thanhtien ELSE 0 END), 0)::float AS tiendichvu,
             COALESCE(SUM(CASE WHEN ct.loaichiphi = 'THUOC' THEN ct.thanhtien ELSE 0 END), 0)::float AS tienthuoc,
             COALESCE(SUM(CASE WHEN ct.loaichiphi = 'TB' THEN ct.thanhtien ELSE 0 END), 0)::float AS tienthietbi,
             COALESCE(SUM(ct.thanhtien), 0)::float AS tong
      FROM v_chi_phi_phieu cp
      JOIN nhan_vien nv ON nv.manv = cp.mabs
      JOIN khoa k ON k.makhoa = nv.makhoa
      JOIN chi_nhanh cn ON cn.macn = k.macn
      LEFT JOIN v_chi_tiet_chi_phi_phieu ct ON ct.maphieu = cp.maphieu
      LEFT JOIN dich_vu dv ON dv.madv = ct.mamathang AND ct.loaichiphi = 'DV'
      WHERE cp.thoigian >= $1::timestamp AND cp.thoigian <= $2::timestamp
      GROUP BY k.macn, cn.tencn, TO_CHAR(cp.thoigian, 'YYYY-MM')
      ORDER BY thang, k.macn
    `;
    const thangCnRes = await query(thangCnSql, [tuTimestamp, denTimestamp]);

    // 3. Chi tiết dịch vụ / thuốc / thiết bị
    const chiTietSql = `
      SELECT 
        CASE 
          WHEN ct.loaichiphi = 'DV' THEN 'DICH_VU'
          WHEN ct.loaichiphi = 'THUOC' THEN 'THUOC'
          ELSE 'THIET_BI'
        END AS loai,
        ct.mamathang AS ma,
        ct.tenmathang AS ten,
        COALESCE(dv.loaidv, tb.loaitb, NULL) AS nhom,
        SUM(ct.soluong)::int AS soluong,
        SUM(ct.thanhtien)::float AS sotien
      FROM v_chi_tiet_chi_phi_phieu ct
      JOIN v_chi_phi_phieu cp ON cp.maphieu = ct.maphieu
      LEFT JOIN dich_vu dv ON dv.madv = ct.mamathang AND ct.loaichiphi = 'DV'
      LEFT JOIN thiet_bi tb ON tb.matb = ct.mamathang AND ct.loaichiphi = 'TB'
      WHERE cp.thoigian >= $1::timestamp AND cp.thoigian <= $2::timestamp
      GROUP BY ct.loaichiphi, ct.mamathang, ct.tenmathang, dv.loaidv, tb.loaitb
      ORDER BY sotien DESC, ten
    `;
    const chiTietRes = await query(chiTietSql, [tuTimestamp, denTimestamp]);

    const theoThangChiNhanh = thangCnRes.rows.map((r) => ({
      maCn: r.macn,
      thang: r.thang,
      soLuot: r.soluot,
      tienKham: r.tienkham,
      tienDichVu: r.tiendichvu,
      tienThuoc: r.tienthuoc,
      tienThietBi: r.tienthietbi,
      tong: r.tong,
    }));

    // Khởi tạo map cho các chi nhánh
    const cnMap = new Map();
    for (const b of branches) {
      cnMap.set(b.macn, {
        maCn: b.macn,
        tenCn: b.tencn,
        soLuot: 0,
        tienKham: 0,
        tienDichVu: 0,
        tienThuoc: 0,
        tienThietBi: 0,
        tong: 0,
        tyTrong: 0,
      });
    }

    for (const r of thangCnRes.rows) {
      const item = cnMap.get(r.macn);
      if (item) {
        item.soLuot += r.soluot;
        item.tienKham += r.tienkham;
        item.tienDichVu += r.tiendichvu;
        item.tienThuoc += r.tienthuoc;
        item.tienThietBi += r.tienthietbi;
        item.tong += r.tong;
      }
    }

    // Nhóm theo tháng toàn chuỗi
    const thangMap = new Map();
    for (const r of thangCnRes.rows) {
      if (!thangMap.has(r.thang)) {
        thangMap.set(r.thang, {
          thang: r.thang,
          soLuot: 0,
          tienKham: 0,
          tienDichVu: 0,
          tienThuoc: 0,
          tienThietBi: 0,
          tong: 0,
        });
      }
      const t = thangMap.get(r.thang);
      t.soLuot += r.soluot;
      t.tienKham += r.tienkham;
      t.tienDichVu += r.tiendichvu;
      t.tienThuoc += r.tienthuoc;
      t.tienThietBi += r.tienthietbi;
      t.tong += r.tong;
    }

    const theoThang = Array.from(thangMap.values()).sort((a, b) => a.thang.localeCompare(b.thang));

    const soLuot = theoThang.reduce((s, t) => s + t.soLuot, 0);
    const tienKham = theoThang.reduce((s, t) => s + t.tienKham, 0);
    const tienDichVu = theoThang.reduce((s, t) => s + t.tienDichVu, 0);
    const tienThuoc = theoThang.reduce((s, t) => s + t.tienThuoc, 0);
    const tienThietBi = theoThang.reduce((s, t) => s + t.tienThietBi, 0);
    const tongDoanhThu = theoThang.reduce((s, t) => s + t.tong, 0);

    // Tính tỷ trọng % cho từng chi nhánh
    const chiNhanh = Array.from(cnMap.values()).map((c) => ({
      ...c,
      tyTrong: tongDoanhThu > 0 ? Math.round((c.tong / tongDoanhThu) * 1000) / 10 : 0,
    }));

    const tongHop = {
      tu: fromDate,
      den: toDate,
      soLuot,
      tienKham,
      tienDichVu,
      tienThuoc,
      tienThietBi,
      tongDoanhThu,
      theoThang,
      chiTiet: chiTietRes.rows.map((r) => ({
        loai: r.loai,
        ma: r.ma,
        ten: r.ten,
        nhom: r.nhom,
        soLuong: r.soluong,
        soTien: r.sotien,
      })),
    };

    res.json({
      tongHop,
      chiNhanh,
      theoThangChiNhanh,
      tuNgay: fromDate,
      denNgay: toDate,
      tongCong: tongHop,
      theoChiNhanh: chiNhanh,
    });
  } catch (err) {
    next(err);
  }
}

export async function getThongKeBenhToanChuoi(req, res, next) {
  try {
    const { thang } = req.query;
    const targetMonth = thang || new Date().toISOString().slice(0, 7);

    // 1. Lấy danh sách mã chi nhánh dùng chung từ danh mục
    const cnRes = await query('SELECT macn FROM chi_nhanh ORDER BY macn');
    const chiNhanh = cnRes.rows.map((r) => r.macn);

    // 2. Truy vấn các đợt điều trị có lượt khám hoặc chữa trong tháng trên toàn chuỗi (qua Global Views)
    const sql = `
      WITH luot_trong_thang AS (
        SELECT maphieukham AS maphieu, sitenguon FROM phieu_kham WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
        UNION
        SELECT maphieudt AS maphieu, sitenguon FROM phieu_dieu_tri WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
      ),
      dot_trong_thang AS (
        SELECT DISTINCT d.madot, d.mabenh, pk.mabn, d.sitenguon
        FROM dot_dieu_tri d
        JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham AND pk.sitenguon = d.sitenguon
        LEFT JOIN phieu_dieu_tri pdt ON pdt.madot = d.madot AND pdt.sitenguon = d.sitenguon
        WHERE (d.maphieukham, d.sitenguon) IN (SELECT maphieu, sitenguon FROM luot_trong_thang)
           OR (pdt.maphieudt, pdt.sitenguon) IN (SELECT maphieu, sitenguon FROM luot_trong_thang)
      )
      SELECT b.mabenh, b.tenbenh, b.maicd10, dt.sitenguon, dt.mabn, dt.madot
      FROM dot_trong_thang dt
      JOIN benh b ON b.mabenh = dt.mabenh
    `;

    const result = await query(sql, [targetMonth]);

    const tongTheoChiNhanh = {};
    for (const cn of chiNhanh) {
      tongTheoChiNhanh[cn] = 0;
    }

    const benhMap = new Map();

    for (const r of result.rows) {
      const maBenh = r.mabenh;
      if (!benhMap.has(maBenh)) {
        const theoCn = {};
        for (const cn of chiNhanh) theoCn[cn] = 0;
        benhMap.set(maBenh, {
          maBenh: r.mabenh,
          tenBenh: r.tenbenh,
          maICD10: r.maicd10,
          soLanMac: 0,
          patients: new Set(),
          theoChiNhanh: theoCn,
        });
      }

      const item = benhMap.get(maBenh);
      item.soLanMac += 1;
      item.patients.add(r.mabn);

      const cn = r.sitenguon;
      if (cn && item.theoChiNhanh[cn] !== undefined) {
        item.theoChiNhanh[cn] += 1;
      }
      if (cn && tongTheoChiNhanh[cn] !== undefined) {
        tongTheoChiNhanh[cn] += 1;
      }
    }

    const tongLanMac = result.rows.length;

    const benh = Array.from(benhMap.values())
      .map((item) => ({
        maBenh: item.maBenh,
        tenBenh: item.tenBenh,
        maICD10: item.maICD10,
        soLanMac: item.soLanMac,
        soBenhNhan: item.patients.size,
        theoChiNhanh: item.theoChiNhanh,
      }))
      .sort((a, b) => b.soLanMac - a.soLanMac || a.maBenh.localeCompare(b.maBenh));

    res.json({
      thang: targetMonth,
      tongLanMac,
      chiNhanh,
      tongTheoChiNhanh,
      benh,
    });
  } catch (err) {
    next(err);
  }
}
