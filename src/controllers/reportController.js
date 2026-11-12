import { query } from '../config/database.js';
import { env } from '../config/env.js';

// ==========================================
// 1. F2: THỐNG KÊ BỆNH THEO THÁNG (/api/bao-cao/thong-ke-benh)
// ==========================================
export async function getThongKeBenh(req, res, next) {
  try {
    const { thang } = req.query; // yyyy-MM
    const targetMonth = thang || new Date().toISOString().slice(0, 7);

    const sql = `
      WITH luot_trong_thang AS (
        SELECT maphieukham AS maphieu FROM phieu_kham WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
        UNION
        SELECT maphieudt AS maphieu FROM phieu_dieu_tri WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
      ),
      dot_trong_thang AS (
        SELECT DISTINCT d.madot, d.mabenh, pk.mabn
        FROM dot_dieu_tri d
        JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
        LEFT JOIN phieu_dieu_tri pdt ON pdt.madot = d.madot
        WHERE d.maphieukham IN (SELECT maphieu FROM luot_trong_thang)
           OR pdt.maphieudt IN (SELECT maphieu FROM luot_trong_thang)
      )
      SELECT b.mabenh, b.tenbenh, b.maicd10,
             COUNT(*)::int AS solanmac,
             COUNT(DISTINCT dt.mabn)::int AS sobenhnhan
      FROM dot_trong_thang dt
      JOIN benh b ON b.mabenh = dt.mabenh
      GROUP BY b.mabenh, b.tenbenh, b.maicd10
      ORDER BY solanmac DESC, sobenhnhan DESC, b.tenbenh
    `;

    const result = await query(sql, [targetMonth]);
    const tongLanMac = result.rows.reduce((sum, r) => sum + r.solanmac, 0);

    res.json({
      thang: targetMonth,
      tongLanMac,
      benh: result.rows.map((r) => ({
        maBenh: r.mabenh,
        tenBenh: r.tenbenh,
        maICD10: r.maicd10,
        soLanMac: r.solanmac,
        soBenhNhan: r.sobenhnhan,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 2. F3: BẢNG LƯƠNG THÁNG BÁC SĨ & Y TÁ (/api/bao-cao/luong)
// ==========================================
export async function getBangLuong(req, res, next) {
  try {
    const { thang } = req.query; // yyyy-MM
    const targetMonth = thang || new Date().toISOString().slice(0, 7);
    const [year, month] = targetMonth.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    // 1. Mức lương cơ sở áp dụng (C17)
    const lcsRes = await query(
      `SELECT mucluong, ngayapdung FROM luong_co_so 
       WHERE ngayapdung <= $1 
       ORDER BY ngayapdung DESC LIMIT 1`,
      [lastDayOfMonth]
    );
    const mucLuongCoSo = lcsRes.rows.length > 0 ? parseFloat(lcsRes.rows[0].mucluong) : 5000000;
    const ngayApDungLuongCoSo = lcsRes.rows.length > 0
      ? lcsRes.rows[0].ngayapdung.toISOString().split('T')[0]
      : `${year}-01-01`;

    const tu = `${targetMonth}-01 00:00:00`;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonthNum = month === 12 ? 1 : month + 1;
    const den = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01 00:00:00`;
    const denNgay = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;

    const thuongMoiDotKhoi = 1000000;
    const thuongMoiLanHoTro = 200000;

    const sql = `
      SELECT x.manv, x.hoten, x.loainv, x.makhoa, x.tenkhoa, x.trangthai, x.hesoluong,
             ROUND(x.hesoluong * $1, 0)::float AS luongcoban,
             x.sodotkhoi::int, x.solanhotro::int,
             (x.sodotkhoi * $2 + x.solanhotro * $3)::float AS thuong,
             (ROUND(x.hesoluong * $1, 0) + x.sodotkhoi * $2 + x.solanhotro * $3)::float AS tongluong
      FROM (
        SELECT nv.manv, nv.hoten, nv.loainv, nv.makhoa, k.tenkhoa, nv.trangthai, nv.hesoluong,
               (SELECT COUNT(*)
                  FROM dot_dieu_tri d
                  JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
                 WHERE pk.mabs = nv.manv AND d.trangthai = 'Đã khỏi'
                   AND d.ngayketthuc >= $4::date AND d.ngayketthuc < $5::date) AS sodotkhoi,
               (SELECT COUNT(*)
                  FROM (
                    SELECT htk.mayt, pk.maphieukham AS maphieu, pk.thoigian
                    FROM ho_tro_kham htk
                    JOIN phieu_kham pk ON pk.maphieukham = htk.maphieukham
                    UNION ALL
                    SELECT htc.mayt, pdt.maphieudt AS maphieu, pdt.thoigian
                    FROM ho_tro_chua htc
                    JOIN phieu_dieu_tri pdt ON pdt.maphieudt = htc.maphieudt
                  ) h
                 WHERE h.mayt = nv.manv AND h.thoigian >= $4::timestamp AND h.thoigian < $5::timestamp) AS solanhotro
        FROM nhan_vien nv
        LEFT JOIN khoa k ON k.makhoa = nv.makhoa
        WHERE nv.ngayvaolam IS NULL OR nv.ngayvaolam < $6::date
      ) x
      WHERE x.trangthai IS DISTINCT FROM 'Ngừng hoạt động' OR x.sodotkhoi > 0 OR x.solanhotro > 0
      ORDER BY x.loainv, x.manv
    `;

    const result = await query(sql, [mucLuongCoSo, thuongMoiDotKhoi, thuongMoiLanHoTro, tu, den, denNgay]);

    const nhanVien = result.rows.map((r) => ({
      maNV: r.manv,
      hoTen: r.hoten,
      loaiNV: r.loainv,
      maKhoa: r.makhoa,
      tenKhoa: r.tenkhoa,
      trangThai: r.trangthai,
      heSoLuong: parseFloat(r.hesoluong),
      luongCoBan: r.luongcoban,
      soDotKhoi: r.sodotkhoi,
      soLanHoTro: r.solanhotro,
      thuong: r.thuong,
      tongLuong: r.tongluong,
    }));

    const tongQuyLuong = nhanVien.reduce((sum, n) => sum + n.tongLuong, 0);

    res.json({
      thang: targetMonth,
      ngayApDungLuongCoSo,
      mucLuongCoSo,
      thuongMoiDotKhoi,
      thuongMoiLanHoTro,
      tongQuyLuong,
      nhanVien,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. F5: DOANH THU THEO KỲ (/api/bao-cao/doanh-thu)
// ==========================================
export async function getDoanhThu(req, res, next) {
  try {
    const { tu, den } = req.query; // yyyy-MM-dd
    const today = new Date().toISOString().split('T')[0];
    const fromDate = tu || `${today.slice(0, 7)}-01`;
    const toDate = den || today;

    const tuTimestamp = `${fromDate} 00:00:00`;
    const denTimestamp = `${toDate} 23:59:59`;

    // 1. Theo tháng
    const theoThangSql = `
      WITH luot AS (
        SELECT maluot, to_char(thoigian, 'YYYY-MM') AS thang
        FROM (
          SELECT maphieukham AS maluot, thoigian FROM phieu_kham WHERE thoigian >= $1::timestamp AND thoigian <= $2::timestamp
          UNION ALL
          SELECT maphieudt AS maluot, thoigian FROM phieu_dieu_tri WHERE thoigian >= $1::timestamp AND thoigian <= $2::timestamp
        ) all_l
      ),
      dv AS (
        SELECT l.thang,
               sum(CASE WHEN d2.loaidv = 'Khám bệnh' OR d2.loaidv = 'Khám' THEN d.soluong * d.dongiaapdung ELSE 0 END) AS kham,
               sum(CASE WHEN d2.loaidv NOT IN ('Khám bệnh', 'Khám') THEN d.soluong * d.dongiaapdung ELSE 0 END) AS dichvu
        FROM (
          SELECT maphieukham AS maluot, madv, soluong, dongiaapdung FROM dv_kham
          UNION ALL
          SELECT maphieudt AS maluot, madv, soluong, dongiaapdung FROM dv_chua
        ) d
        JOIN luot l ON l.maluot = d.maluot
        LEFT JOIN dich_vu d2 ON d2.madv = d.madv
        GROUP BY l.thang
      ),
      th AS (
        SELECT l.thang, sum(k.soluong * k.dongiaapdung) AS thuoc
        FROM (
          SELECT maphieukham AS maluot, mathuoc, soluong, dongiaapdung FROM ke_don
          UNION ALL
          SELECT maphieudt AS maluot, mathuoc, soluong, dongiaapdung FROM dung_thuoc
        ) k
        JOIN luot l ON l.maluot = k.maluot
        GROUP BY l.thang
      ),
      tb AS (
        SELECT l.thang, sum(s.solan * s.dongiaapdung) AS thietbi
        FROM su_dung_tb s
        JOIN luot l ON l.maluot = s.maphieudt
        GROUP BY l.thang
      ),
      sl AS (SELECT thang, count(*) AS soluot FROM luot GROUP BY thang)
      SELECT sl.thang, sl.soluot::int,
             COALESCE(dv.kham, 0)::float AS tienkham,
             COALESCE(dv.dichvu, 0)::float AS tiendichvu,
             COALESCE(th.thuoc, 0)::float AS tienthuoc,
             COALESCE(tb.thietbi, 0)::float AS tienthietbi,
             (COALESCE(dv.kham, 0) + COALESCE(dv.dichvu, 0) + COALESCE(th.thuoc, 0) + COALESCE(tb.thietbi, 0))::float AS tong
      FROM sl
      LEFT JOIN dv ON dv.thang = sl.thang
      LEFT JOIN th ON th.thang = sl.thang
      LEFT JOIN tb ON tb.thang = sl.thang
      ORDER BY sl.thang
    `;
    const thangRes = await query(theoThangSql, [tuTimestamp, denTimestamp]);

    // 2. Chi tiết mặt hàng
    const chiTietSql = `
      WITH luot AS (
        SELECT maphieukham AS maluot FROM phieu_kham WHERE thoigian >= $1::timestamp AND thoigian <= $2::timestamp
        UNION ALL
        SELECT maphieudt AS maluot FROM phieu_dieu_tri WHERE thoigian >= $1::timestamp AND thoigian <= $2::timestamp
      )
      SELECT 'DICH_VU' AS loai, d.madv AS ma, COALESCE(dv.tendv, d.madv) AS ten, dv.loaidv AS nhom,
             sum(d.soluong)::int AS soluong, sum(d.soluong * d.dongiaapdung)::float AS sotien
      FROM (
        SELECT maphieukham AS maluot, madv, soluong, dongiaapdung FROM dv_kham
        UNION ALL
        SELECT maphieudt AS maluot, madv, soluong, dongiaapdung FROM dv_chua
      ) d
      JOIN luot l ON l.maluot = d.maluot
      LEFT JOIN dich_vu dv ON dv.madv = d.madv
      GROUP BY d.madv, dv.tendv, dv.loaidv
      UNION ALL
      SELECT 'THUOC', k.mathuoc, COALESCE(t.tenthuoc, k.mathuoc), NULL,
             sum(k.soluong)::int, sum(k.soluong * k.dongiaapdung)::float
      FROM (
        SELECT maphieukham AS maluot, mathuoc, soluong, dongiaapdung FROM ke_don
        UNION ALL
        SELECT maphieudt AS maluot, mathuoc, soluong, dongiaapdung FROM dung_thuoc
      ) k
      JOIN luot l ON l.maluot = k.maluot
      LEFT JOIN thuoc t ON t.mathuoc = k.mathuoc
      GROUP BY k.mathuoc, t.tenthuoc
      UNION ALL
      SELECT 'THIET_BI', s.matb, COALESCE(tb.tentb, s.matb), tb.loaitb,
             sum(s.solan)::int, sum(s.solan * s.dongiaapdung)::float
      FROM su_dung_tb s
      JOIN luot l ON l.maluot = s.maphieudt
      LEFT JOIN thiet_bi tb ON tb.matb = s.matb
      GROUP BY s.matb, tb.tentb, tb.loaitb
      ORDER BY sotien DESC, ten
    `;
    const chiTietRes = await query(chiTietSql, [tuTimestamp, denTimestamp]);

    const theoThang = thangRes.rows.map((r) => ({
      thang: r.thang,
      soLuot: r.soluot,
      tienKham: r.tienkham,
      tienDichVu: r.tiendichvu,
      tienThuoc: r.tienthuoc,
      tienThietBi: r.tienthietbi,
      tong: r.tong,
    }));

    const soLuot = theoThang.reduce((s, t) => s + t.soLuot, 0);
    const tienKham = theoThang.reduce((s, t) => s + t.tienKham, 0);
    const tienDichVu = theoThang.reduce((s, t) => s + t.tienDichVu, 0);
    const tienThuoc = theoThang.reduce((s, t) => s + t.tienThuoc, 0);
    const tienThietBi = theoThang.reduce((s, t) => s + t.tienThietBi, 0);
    const tongDoanhThu = theoThang.reduce((s, t) => s + t.tong, 0);

    res.json({
      tu: fromDate,
      den: toDate,
      soLuot,
      tienKham,
      tienDichVu,
      tienThuoc,
      tienThietBi,
      tongDoanhThu,
      theoThang,
      chiTiet: chiTietRes.rows.map((c) => ({
        loai: c.loai,
        ma: c.ma,
        ten: c.ten,
        nhom: c.nhom,
        soLuong: c.soluong,
        soTien: c.sotien,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 4. TỔNG QUAN CHI NHÁNH (/api/tong-quan)
// ==========================================
export async function getTongQuan(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const targetMonth = today.slice(0, 7);

    // 1. Chỉ số thống kê (Stats)
    const statsRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM phieu_kham WHERE thoigian::date = $1) AS kham_hom_nay,
        (SELECT COUNT(*)::int FROM phieu_dieu_tri WHERE thoigian::date = $1) AS chua_hom_nay,
        (SELECT COUNT(*)::int FROM dot_dieu_tri WHERE trangthai = 'Đang điều trị') AS dot_dang_dieu_tri,
        (SELECT COUNT(*)::int FROM v_chi_phi_phieu WHERE thoigian::date >= DATE_TRUNC('month', $1::date) AND thoigian::date <= $1::date) AS so_luot_thang,
        (SELECT COALESCE(SUM(tongtien), 0) FROM v_chi_phi_phieu WHERE thoigian::date >= DATE_TRUNC('month', $1::date) AND thoigian::date <= $1::date) AS doanh_thu_thang,
        (SELECT COUNT(*)::int FROM (
          SELECT mabn, MIN(thoigian) as first_kham FROM phieu_kham GROUP BY mabn
        ) t WHERE first_kham::date >= DATE_TRUNC('month', $1::date) AND first_kham::date <= $1::date) AS benh_nhan_moi_thang
    `, [today]);
    const s = statsRes.rows[0];

    // 2. Lượt gần đây (8 lượt mới nhất)
    const luotSql = `
      WITH AllLuot AS (
        SELECT 
          pk.maphieukham AS maluot,
          pk.thoigian,
          'KHAM'::varchar AS loailuot,
          pk.ngayhentaikham,
          pk.ghichu,
          nv.makhoa,
          k.tenkhoa,
          pk.mabs,
          nv.hoten AS tenbs,
          pk.mabn,
          bn.hoten AS tenbn,
          pk.lydokham,
          pk.trieuchung,
          pk.ketluankham,
          pk.maphieugoc,
          NULL::varchar AS macddt,
          NULL::int AS lanthu,
          NULL::text AS ketluansauchua,
          NULL::varchar AS tinhtrangsauchua,
          (
            SELECT string_agg(b.tenbenh, ', ')
            FROM dot_dieu_tri d
            JOIN benh b ON b.mabenh = d.mabenh
            WHERE d.maphieukham = pk.maphieukham
          ) AS benh,
          NULL::text AS hinhthucchua,
          (
            SELECT string_agg(nv_yt.hoten, ', ')
            FROM ho_tro_kham htk
            JOIN nhan_vien nv_yt ON nv_yt.manv = htk.mayt
            WHERE htk.maphieukham = pk.maphieukham
          ) AS ytahotro,
          COALESCE(cp.tiendichvu, 0) AS tiendichvu,
          COALESCE(cp.tienthuoc, 0) AS tienthuoc,
          COALESCE(cp.tienthietbi, 0) AS tienthietbi,
          COALESCE(cp.tongtien, 0) AS tongtien
        FROM phieu_kham pk
        JOIN benh_nhan bn ON bn.mabn = pk.mabn
        JOIN nhan_vien nv ON nv.manv = pk.mabs
        JOIN khoa k ON k.makhoa = nv.makhoa
        LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
        WHERE pk.maphieugoc IS NULL

        UNION ALL

        SELECT 
          pdt.maphieudt AS maluot,
          pdt.thoigian,
          'CHUA'::varchar AS loailuot,
          pdt.ngayhentaikham,
          pdt.ghichu,
          nv.makhoa,
          k.tenkhoa,
          pdt.mabs,
          nv.hoten AS tenbs,
          pk.mabn,
          bn.hoten AS tenbn,
          NULL::text AS lydokham,
          NULL::text AS trieuchung,
          NULL::text AS ketluankham,
          NULL::varchar AS maphieugoc,
          pdt.madot AS macddt,
          pdt.lanthu,
          pdt.ketluansauchua,
          pdt.tinhtrangsauchua,
          b.tenbenh AS benh,
          (
            SELECT string_agg(hinhthuc, ', ')
            FROM pdt_hinh_thuc
            WHERE maphieudt = pdt.maphieudt
          ) AS hinhthucchua,
          (
            SELECT string_agg(nv_yt.hoten, ', ')
            FROM ho_tro_chua htc
            JOIN nhan_vien nv_yt ON nv_yt.manv = htc.mayt
            WHERE htc.maphieudt = pdt.maphieudt
          ) AS ytahotro,
          COALESCE(cp.tiendichvu, 0) AS tiendichvu,
          COALESCE(cp.tienthuoc, 0) AS tienthuoc,
          COALESCE(cp.tienthietbi, 0) AS tienthietbi,
          COALESCE(cp.tongtien, 0) AS tongtien
        FROM phieu_dieu_tri pdt
        JOIN dot_dieu_tri d ON d.madot = pdt.madot
        JOIN benh b ON b.mabenh = d.mabenh
        JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
        JOIN benh_nhan bn ON bn.mabn = pk.mabn
        JOIN nhan_vien nv ON nv.manv = pdt.mabs
        JOIN khoa k ON k.makhoa = nv.makhoa
        LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pdt.maphieudt
      )
      SELECT * FROM AllLuot
      ORDER BY thoigian DESC
      LIMIT 8
    `;
    const luotRes = await query(luotSql);
    const luotGanDay = luotRes.rows.map((r) => ({
      maLuot: r.maluot,
      thoiGian: r.thoigian.toISOString(),
      loaiLuot: r.loailuot,
      ngayHenTaiKham: r.ngayhentaikham ? r.ngayhentaikham.toISOString().split('T')[0] : null,
      ghiChu: r.ghichu,
      maKhoa: r.makhoa,
      tenKhoa: r.tenkhoa,
      maBS: r.mabs,
      tenBS: r.tenbs,
      maBN: r.mabn,
      tenBN: r.tenbn,
      lyDoKham: r.lydokham,
      trieuChung: r.trieuchung,
      ketLuanKham: r.ketluankham,
      maPhieuGoc: r.maphieugoc || null,
      maCDDT: r.macddt,
      lanThu: r.lanthu,
      ketLuanSauChua: r.ketluansauchua,
      tinhTrangSauChua: r.tinhtrangsauchua,
      benh: r.benh,
      hinhThucChua: r.hinhthucchua,
      yTaHoTro: r.ytahotro,
      tienDichVu: parseFloat(r.tiendichvu),
      tienThuoc: parseFloat(r.tienthuoc),
      tienThietBi: parseFloat(r.tienthietbi),
      tongTien: parseFloat(r.tongtien),
    }));

    // 3. Đợt đang điều trị (lichHen & quaHan)
    const dotRes = await query(`
      WITH chua AS (
        SELECT pdt.madot, COUNT(*)::int AS solandachua, MAX(pdt.thoigian) AS lanchuagannhat
        FROM phieu_dieu_tri pdt
        GROUP BY pdt.madot
      ),
      hen AS (
        SELECT DISTINCT ON (y.madot) y.madot, y.ngayhentaikham
        FROM (
          SELECT d.madot, pk.thoigian, pk.ngayhentaikham
          FROM dot_dieu_tri d JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
          UNION ALL
          SELECT pdt.madot, pdt.thoigian, pdt.ngayhentaikham
          FROM phieu_dieu_tri pdt
        ) y
        WHERE y.ngayhentaikham IS NOT NULL
        ORDER BY y.madot, y.thoigian DESC
      )
      SELECT 
        d.madot AS macddt,
        d.mabenh,
        b.tenbenh,
        b.maicd10,
        d.mucdo,
        d.solanchuacanthiet,
        COALESCE(c.solandachua, 0) AS solandachua,
        d.trangthai,
        pk.thoigian AS ngaybatdau,
        d.ngayketthuc,
        d.maphieukham AS maluotkham,
        pk.mabn,
        bn.hoten AS tenbn,
        pk.mabs,
        nv.hoten AS tenbs,
        nv.makhoa,
        k.tenkhoa,
        k.macn,
        c.lanchuagannhat,
        COALESCE(c.lanchuagannhat, pk.thoigian) AS luotgannhat,
        h.ngayhentaikham,
        (d.trangthai = 'Đang điều trị' AND COALESCE(c.lanchuagannhat, pk.thoigian) < (CURRENT_DATE - INTERVAL '30 days')) AS quahan
      FROM dot_dieu_tri d
      JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
      JOIN benh_nhan bn ON bn.mabn = pk.mabn
      JOIN nhan_vien nv ON nv.manv = pk.mabs
      JOIN khoa k ON k.makhoa = nv.makhoa
      JOIN benh b ON b.mabenh = d.mabenh
      LEFT JOIN chua c ON c.madot = d.madot
      LEFT JOIN hen h ON h.madot = d.madot
      WHERE d.trangthai = 'Đang điều trị'
      ORDER BY h.ngayhentaikham ASC NULLS LAST, luotgannhat DESC
    `);

    const allDots = dotRes.rows.map((d) => ({
      maCDDT: d.macddt,
      maBenh: d.mabenh,
      tenBenh: d.tenbenh,
      maICD10: d.maicd10,
      mucDo: d.mucdo,
      soLanChuaCanThiet: d.solanchuacanthiet,
      soLanDaChua: d.solandachua,
      trangThai: d.trangthai,
      ngayBatDau: d.ngaybatdau.toISOString().split('T')[0],
      ngayKetThuc: d.ngayketthuc ? d.ngayketthuc.toISOString().split('T')[0] : null,
      maLuotKham: d.maluotkham,
      maBN: d.mabn,
      tenBN: d.tenbn,
      maBS: d.mabs,
      tenBS: d.tenbs,
      maKhoa: d.makhoa,
      tenKhoa: d.tenkhoa,
      maCn: d.macn,
      lanChuaGanNhat: d.lanchuagannhat ? d.lanchuagannhat.toISOString().split('T')[0] : null,
      luotGanNhat: d.luotgannhat.toISOString().split('T')[0],
      ngayHenTaiKham: d.ngayhentaikham ? d.ngayhentaikham.toISOString().split('T')[0] : null,
      quaHan: Boolean(d.quahan),
    }));

    // lichHen: có ngày hẹn từ hôm nay trở đi, tối đa 8 đợt
    const lichHen = allDots
      .filter((d) => d.ngayHenTaiKham && d.ngayHenTaiKham >= today)
      .slice(0, 8);

    // quaHan: quá 30 ngày chưa quay lại
    const quaHan = allDots.filter((d) => d.quaHan);

    // 4. Top 5 bệnh mắc nhiều nhất trong tháng
    const topBenhRes = await query(`
      WITH luot_trong_thang AS (
        SELECT maphieukham AS maphieu FROM phieu_kham WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
        UNION
        SELECT maphieudt AS maphieu FROM phieu_dieu_tri WHERE TO_CHAR(thoigian, 'YYYY-MM') = $1
      ),
      dot_trong_thang AS (
        SELECT DISTINCT d.madot, d.mabenh, pk.mabn
        FROM dot_dieu_tri d
        JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
        LEFT JOIN phieu_dieu_tri pdt ON pdt.madot = d.madot
        WHERE d.maphieukham IN (SELECT maphieu FROM luot_trong_thang)
           OR pdt.maphieudt IN (SELECT maphieu FROM luot_trong_thang)
      )
      SELECT b.mabenh, b.tenbenh, b.maicd10,
             COUNT(*)::int AS solanmac,
             COUNT(DISTINCT dt.mabn)::int AS sobenhnhan
      FROM dot_trong_thang dt
      JOIN benh b ON b.mabenh = dt.mabenh
      GROUP BY b.mabenh, b.tenbenh, b.maicd10
      ORDER BY solanmac DESC, sobenhnhan DESC, b.tenbenh
      LIMIT 5
    `, [targetMonth]);

    const topBenh = topBenhRes.rows.map((r) => ({
      maBenh: r.mabenh,
      tenBenh: r.tenbenh,
      maICD10: r.maicd10,
      soLanMac: r.solanmac,
      soBenhNhan: r.sobenhnhan,
    }));

    res.json({
      ngay: today,
      khamHomNay: s.kham_hom_nay,
      chuaHomNay: s.chua_hom_nay,
      dotDangDieuTri: s.dot_dang_dieu_tri,
      soLuotThang: s.so_luot_thang,
      doanhThuThang: parseFloat(s.doanh_thu_thang),
      benhNhanMoiThang: s.benh_nhan_moi_thang,
      luotGanDay,
      lichHen,
      quaHan,
      topBenh,
    });
  } catch (err) {
    next(err);
  }
}
