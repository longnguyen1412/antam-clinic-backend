import { query } from '../config/database.js';
import { env } from '../config/env.js';

// ==========================================
// 1. F2: THỐNG KÊ BỆNH THEO THÁNG
// ==========================================
export async function getThongKeBenh(req, res, next) {
  try {
    const { thang } = req.query; // yyyy-MM
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

// ==========================================
// 2. F3: BẢNG LƯƠNG THÁNG BÁC SĨ & Y TÁ
// ==========================================
export async function getBangLuong(req, res, next) {
  try {
    const { thang } = req.query; // yyyy-MM
    const targetMonth = thang || new Date().toISOString().slice(0, 7);

    // 1. Lấy mức lương cơ sở áp dụng (C17)
    // Ngày cuối cùng của tháng T
    const [year, month] = targetMonth.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const lcsRes = await query(
      `SELECT mucluong FROM luong_co_so 
       WHERE ngayapdung <= $1 
       ORDER BY ngayapdung DESC LIMIT 1`,
      [lastDayOfMonth]
    );
    const mucLuongCoSo = lcsRes.rows.length > 0 ? parseFloat(lcsRes.rows[0].mucluong) : 5000000;

    // 2. Tính lương Bác sĩ (C15)
    // Thưởng 1.000.000 đ cho mỗi đợt kết thúc 'Đã khỏi' trong tháng mà bác sĩ thực hiện phiếu điều trị kết luận 'Khỏi'
    const bsSql = `
      SELECT nv.manv, nv.hoten, nv.hesoluong, nv.makhoa, k.tenkhoa,
             COALESCE(thuong.soca_khoi, 0)::int AS socakhoi
      FROM bac_si bs
      JOIN nhan_vien nv ON nv.manv = bs.manv
      JOIN khoa k ON k.makhoa = nv.makhoa
      LEFT JOIN (
        SELECT pdt.mabs, COUNT(DISTINCT d.madot) AS soca_khoi
        FROM phieu_dieu_tri pdt
        JOIN dot_dieu_tri d ON d.madot = pdt.madot
        WHERE d.trangthai = 'Đã khỏi'
          AND TO_CHAR(d.ngayketthuc, 'YYYY-MM') = $1
          AND (pdt.tinhtrangsauchua = 'Khỏi' OR pdt.ketluansauchua ILIKE '%khỏi%')
        GROUP BY pdt.mabs
      ) thuong ON thuong.mabs = bs.manv
      WHERE nv.trangthai = 'Đang làm việc'
      ORDER BY nv.manv
    `;
    const bsRes = await query(bsSql, [targetMonth]);

    const danhSachBacSi = bsRes.rows.map((b) => {
      const heSo = parseFloat(b.hesoluong);
      const luongChinh = heSo * mucLuongCoSo;
      const thuong = b.socakhoi * 1000000;
      return {
        maNV: b.manv,
        hoTen: b.hoten,
        maKhoa: b.makhoa,
        tenKhoa: b.tenkhoa,
        heSoLuong: heSo,
        mucLuongCoSo,
        luongChinh,
        soCaKhoi: b.socakhoi,
        thuong,
        tongLuong: luongChinh + thuong,
      };
    });

    // 3. Tính lương Y tá (C16)
    // Phụ cấp 200.000 đ cho mỗi phiếu có tham gia hỗ trợ trong tháng
    const ytSql = `
      SELECT nv.manv, nv.hoten, nv.hesoluong, nv.makhoa, k.tenkhoa,
             COALESCE(ht.solan, 0)::int AS solanhotro
      FROM y_ta yt
      JOIN nhan_vien nv ON nv.manv = yt.manv
      JOIN khoa k ON k.makhoa = nv.makhoa
      LEFT JOIN (
        SELECT mayt, COUNT(DISTINCT maphieu) AS solan FROM (
          SELECT htk.mayt, pk.maphieukham AS maphieu
          FROM ho_tro_kham htk
          JOIN phieu_kham pk ON pk.maphieukham = htk.maphieukham
          WHERE TO_CHAR(pk.thoigian, 'YYYY-MM') = $1
          UNION ALL
          SELECT htc.mayt, pdt.maphieudt AS maphieu
          FROM ho_tro_chua htc
          JOIN phieu_dieu_tri pdt ON pdt.maphieudt = htc.maphieudt
          WHERE TO_CHAR(pdt.thoigian, 'YYYY-MM') = $1
        ) all_ht
        GROUP BY mayt
      ) ht ON ht.mayt = yt.manv
      WHERE nv.trangthai = 'Đang làm việc'
      ORDER BY nv.manv
    `;
    const ytRes = await query(ytSql, [targetMonth]);

    const danhSachYTa = ytRes.rows.map((y) => {
      const heSo = parseFloat(y.hesoluong);
      const luongChinh = heSo * mucLuongCoSo;
      const phuCap = y.solanhotro * 200000;
      return {
        maNV: y.manv,
        hoTen: y.hoten,
        maKhoa: y.makhoa,
        tenKhoa: y.tenkhoa,
        heSoLuong: heSo,
        mucLuongCoSo,
        luongChinh,
        soLanHoTro: y.solanhotro,
        thuong: phuCap,
        tongLuong: luongChinh + phuCap,
      };
    });

    const tongQuyLuong =
      danhSachBacSi.reduce((s, b) => s + b.tongLuong, 0) +
      danhSachYTa.reduce((s, y) => s + y.tongLuong, 0);

    res.json({
      thang: targetMonth,
      mucLuongCoSo,
      tongQuyLuong,
      bacSi: danhSachBacSi,
      yTa: danhSachYTa,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. F5: DOANH THU THEO KỲ
// ==========================================
export async function getDoanhThu(req, res, next) {
  try {
    const { tu, den } = req.query; // yyyy-MM-dd
    const today = new Date().toISOString().split('T')[0];
    const fromDate = tu || `${today.slice(0, 7)}-01`;
    const toDate = den || today;

    // Tổng hợp doanh thu từ view V_CHI_PHI_PHIEU
    const sumSql = `
      SELECT 
        COALESCE(SUM(tiendichvu), 0) AS tiendichvu,
        COALESCE(SUM(tienthuoc), 0) AS tienthuoc,
        COALESCE(SUM(tienthietbi), 0) AS tienthietbi,
        COALESCE(SUM(tongtien), 0) AS tongdoanhthu,
        COUNT(*)::int AS soluot
      FROM v_chi_phi_phieu
      WHERE thoigian::date >= $1 AND thoigian::date <= $2
    `;
    const sumRes = await query(sumSql, [fromDate, toDate]);
    const summary = sumRes.rows[0];

    // Chi tiết theo ngày/tháng
    const detailSql = `
      SELECT 
        TO_CHAR(thoigian, 'YYYY-MM-DD') AS ngay,
        COUNT(*)::int AS soluot,
        SUM(tiendichvu) AS tiendichvu,
        SUM(tienthuoc) AS tienthuoc,
        SUM(tienthietbi) AS tienthietbi,
        SUM(tongtien) AS tongtien
      FROM v_chi_phi_phieu
      WHERE thoigian::date >= $1 AND thoigian::date <= $2
      GROUP BY TO_CHAR(thoigian, 'YYYY-MM-DD')
      ORDER BY ngay ASC
    `;
    const detailRes = await query(detailSql, [fromDate, toDate]);

    res.json({
      tuNgay: fromDate,
      denNgay: toDate,
      soLuot: summary.soluot,
      tienDichVu: parseFloat(summary.tiendichvu),
      tienThuoc: parseFloat(summary.tienthuoc),
      tienThietBi: parseFloat(summary.tienthietbi),
      tongDoanhThu: parseFloat(summary.tongdoanhthu),
      theoThang: [],
      chiTiet: detailRes.rows.map((d) => ({
        ngay: d.ngay,
        soLuot: d.soluot,
        tienDichVu: parseFloat(d.tiendichvu || 0),
        tienThuoc: parseFloat(d.tienthuoc || 0),
        tienThietBi: parseFloat(d.tienthietbi || 0),
        tongTien: parseFloat(d.tongtien || 0),
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

    const statsRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM phieu_kham WHERE thoigian::date = $1) AS so_kham_homnay,
        (SELECT COUNT(*)::int FROM phieu_dieu_tri WHERE thoigian::date = $1) AS so_chua_homnay,
        (SELECT COUNT(*)::int FROM dot_dieu_tri WHERE trangthai = 'Đang điều trị') AS so_dot_dang_chua,
        (SELECT COUNT(*)::int FROM benh_nhan) AS tong_so_benh_nhan,
        (SELECT COALESCE(SUM(tongtien), 0) FROM v_chi_phi_phieu WHERE thoigian::date = $1) AS doanh_thu_homnay,
        (SELECT COUNT(*)::int FROM hoa_don WHERE giamtru > 0) AS so_hoa_don_giam
    `, [today]);

    const s = statsRes.rows[0];

    res.json({
      site: env.siteCode,
      siteName: env.siteName,
      ngay: today,
      soKhamHomNay: s.so_kham_homnay,
      soChuaHomNay: s.so_chua_homnay,
      soDotDangChua: s.so_dot_dang_chua,
      tongSoBenhNhan: s.tong_so_benh_nhan,
      doanhThuHomNay: parseFloat(s.doanh_thu_homnay),
    });
  } catch (err) {
    next(err);
  }
}
