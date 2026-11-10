import { query } from '../config/database.js';
import { env } from '../config/env.js';

// ==========================================
// 1. DANH SÁCH BỆNH NHÂN (BENH_NHAN)
// ==========================================
export async function getPatients(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `
      SELECT bn.mabn, bn.hoten, bn.ngaysinh, bn.gioitinh, bn.cccd, bn.sodienthoai,
             bn.diachi, bn.sothebhyt, bn.nhommau, bn.tiensudiung,
             (SELECT COUNT(*)::int FROM phieu_kham WHERE mabn = bn.mabn) AS solankham,
             (SELECT MAX(thoigian) FROM phieu_kham WHERE mabn = bn.mabn) AS ngaykhamgannhat
      FROM benh_nhan bn
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (bn.hoten ILIKE $1 OR bn.mabn ILIKE $1 OR bn.sodienthoai ILIKE $1 OR bn.cccd ILIKE $1)`;
    }
    sql += ` ORDER BY bn.mabn DESC`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maBN: r.mabn,
      hoTen: r.hoten,
      ngaySinh: r.ngaysinh ? r.ngaysinh.toISOString().split('T')[0] : null,
      gioiTinh: r.gioitinh,
      cccd: r.cccd,
      soDienThoai: r.sodienthoai,
      diaChi: r.diachi,
      soTheBHYT: r.sothebhyt,
      nhomMau: r.nhommau,
      tienSuDiUng: r.tiensudiung,
      soLanKham: r.solankham,
      ngayKhamGanNhat: r.ngaykhamgannhat ? r.ngaykhamgannhat.toISOString() : null,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 2. TIẾP ĐÓN: TRA CỨU CỤC BỘ & TOÀN CHUỖI
// ==========================================
export async function getPatientReception(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ taiChiNhanh: [], oChiNhanhKhac: [] });
    }
    const cleanQ = q.trim();

    // 1. Tìm tại chi nhánh hiện tại
    const localRes = await query(
      `SELECT bn.mabn, bn.hoten, bn.ngaysinh, bn.gioitinh, bn.cccd, bn.sodienthoai,
              bn.sothebhyt, bn.diachi,
              (
                SELECT COUNT(*)::int 
                FROM dot_dieu_tri d 
                JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham 
                WHERE pk.mabn = bn.mabn AND d.trangthai = 'Đang điều trị'
              ) AS sodotdangdieutri
       FROM benh_nhan bn
       WHERE bn.mabn ILIKE $1 OR bn.hoten ILIKE $1 OR bn.sodienthoai ILIKE $1 OR bn.cccd ILIKE $1 OR bn.sothebhyt ILIKE $1
       ORDER BY bn.mabn`,
      [`%${cleanQ}%`]
    );

    const taiChiNhanh = localRes.rows.map((r) => ({
      maBN: r.mabn,
      hoTen: r.hoten,
      ngaySinh: r.ngaysinh ? r.ngaysinh.toISOString().split('T')[0] : null,
      gioiTinh: r.gioitinh,
      cccd: r.cccd,
      soDienThoai: r.sodienthoai,
      soTheBHYT: r.sothebhyt,
      diaChi: r.diachi,
      soDotDangDieuTri: r.sodotdangdieutri,
    }));

    // 2. Tra cứu toàn chuỗi nếu chưa thấy hoặc tìm theo CCCD/BHYT
    let oChiNhanhKhac = [];
    try {
      const tcRes = await query(
        `SELECT DISTINCT mabn, macn 
         FROM tra_cuu_benh_nhan_toan_chuoi 
         WHERE cccd = $1 OR sothebhyt = $1`,
        [cleanQ]
      );
      // Lọc bỏ bệnh nhân đã có tại chi nhánh
      const localMaBNs = new Set(taiChiNhanh.map((bn) => bn.maBN));
      oChiNhanhKhac = tcRes.rows
        .filter((r) => !localMaBNs.has(r.mabn))
        .map((r) => ({
          maBN: r.mabn,
          maCn: r.macn,
        }));
    } catch {
      // Bỏ qua nếu view FDW chưa cấu hình hoặc chạy offline
      oChiNhanhKhac = [];
    }

    res.json({
      taiChiNhanh,
      oChiNhanhKhac,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. TẠO BỆNH NHÂN MỚI (BR4, BN-CNx-NNNN)
// ==========================================
export async function createPatient(req, res, next) {
  try {
    const {
      maBN, hoTen, ngaySinh, gioiTinh, cccd, soDienThoai,
      diaChi, soTheBHYT, nhomMau, tienSuDiUng
    } = req.body;

    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';
    let finalMaBN = maBN;

    if (!finalMaBN) {
      const cRes = await query("SELECT COUNT(*)::int AS count FROM benh_nhan WHERE mabn LIKE $1", [`BN-${branchPrefix}-%`]);
      const nextId = String(cRes.rows[0].count + 1).padStart(4, '0');
      finalMaBN = `BN-${branchPrefix}-${nextId}`;
    }

    await query(
      `INSERT INTO benh_nhan (mabn, hoten, ngaysinh, gioitinh, cccd, sodienthoai, diachi, sothebhyt, nhommau, tiensudiung)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [finalMaBN, hoTen, ngaySinh || null, gioiTinh || 'Khác', cccd || null, soDienThoai || null,
       diaChi || null, soTheBHYT || null, nhomMau || null, tienSuDiUng || null]
    );

    res.json({
      maBN: finalMaBN,
      hoTen,
      ngaySinh,
      gioiTinh,
      cccd,
      soDienThoai,
      diaChi,
      soTheBHYT,
      nhomMau,
      tienSuDiUng,
      soLanKham: 0,
      ngayKhamGanNhat: null,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 4. SỬA BỆNH NHÂN
// ==========================================
export async function updatePatient(req, res, next) {
  try {
    const { maBN } = req.params;
    const {
      hoTen, ngaySinh, gioiTinh, cccd, soDienThoai,
      diaChi, soTheBHYT, nhomMau, tienSuDiUng
    } = req.body;

    await query(
      `UPDATE benh_nhan
       SET hoten = COALESCE($1, hoten),
           ngaysinh = COALESCE($2, ngaysinh),
           gioitinh = COALESCE($3, gioitinh),
           cccd = COALESCE($4, cccd),
           sodienthoai = COALESCE($5, sodienthoai),
           diachi = COALESCE($6, diachi),
           sothebhyt = COALESCE($7, sothebhyt),
           nhommau = COALESCE($8, nhommau),
           tiensudiung = COALESCE($9, tiensudiung)
       WHERE mabn = $10`,
      [hoTen, ngaySinh || null, gioiTinh, cccd || null, soDienThoai || null,
       diaChi || null, soTheBHYT || null, nhomMau || null, tienSuDiUng || null, maBN]
    );

    res.json({ maBN, message: 'Cập nhật bệnh nhân thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 5. XÓA BỆNH NHÂN
// ==========================================
export async function deletePatient(req, res, next) {
  try {
    const { maBN } = req.params;
    await query('DELETE FROM benh_nhan WHERE mabn = $1', [maBN]);
    res.json({ mode: 'HARD', message: 'Đã xóa bệnh nhân thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 6. HỒ SƠ BỆNH NHÂN TOÀN DIỆN (F4)
// ==========================================
export async function getPatientMedicalRecord(req, res, next) {
  try {
    const { maBN } = req.params;

    // 1. Thông tin bệnh nhân kèm tuổi (V_BENH_NHAN_TUOI)
    const bnRes = await query('SELECT * FROM v_benh_nhan_tuoi WHERE mabn = $1', [maBN]);
    if (bnRes.rows.length === 0) {
      return res.status(404).json({ status: 404, message: `Không tìm thấy bệnh nhân ${maBN}` });
    }
    const bn = bnRes.rows[0];

    // 2. Các đợt điều trị của bệnh nhân (V_TIEN_TRINH_DOT)
    const dotsRes = await query(
      `SELECT td.madot, td.maphieukham, td.ngaybatdau, td.mabenh, td.tenbenh,
              td.mucdo, td.solanchuacanthiet, td.solandachua, td.ngayketthuc, td.trangthai,
              nv.makhoa, k.tenkhoa, pk.mabs, nv.hoten AS tenbs
       FROM v_tien_trinh_dot td
       JOIN phieu_kham pk ON pk.maphieukham = td.maphieukham
       JOIN nhan_vien nv ON nv.manv = pk.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       WHERE pk.mabn = $1
       ORDER BY td.ngaybatdau DESC`,
      [maBN]
    );

    // 3. Lịch sử các lần khám (PHIEU_KHAM)
    const pkRes = await query(
      `SELECT pk.maphieukham, pk.thoigian, pk.lydokham, pk.trieuchung, pk.ketluankham,
              pk.ngayhentaikham, pk.ghichu, pk.mabs, nv.hoten AS tenbs, nv.makhoa, k.tenkhoa,
              cp.tongtien, hd.mahd, hd.trangthai AS trangthaihoadon
       FROM phieu_kham pk
       JOIN nhan_vien nv ON nv.manv = pk.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
       LEFT JOIN v_hoa_don hd ON hd.maphieukham = pk.maphieukham
       WHERE pk.mabn = $1
       ORDER BY pk.thoigian DESC`,
      [maBN]
    );

    // 4. Lịch sử các lần chữa (PHIEU_DIEU_TRI)
    const pdtRes = await query(
      `SELECT pdt.maphieudt, pdt.thoigian, pdt.madot, pdt.lanthu, pdt.ketluansauchua,
              pdt.tinhtrangsauchua, pdt.ngayhentaikham, pdt.ghichu, pdt.mabs, nv.hoten AS tenbs,
              nv.makhoa, k.tenkhoa, b.tenbenh,
              cp.tongtien, hd.mahd, hd.trangthai AS trangthaihoadon
       FROM phieu_dieu_tri pdt
       JOIN dot_dieu_tri d ON d.madot = pdt.madot
       JOIN benh b ON b.mabenh = d.mabenh
       JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
       JOIN nhan_vien nv ON nv.manv = pdt.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pdt.maphieudt
       LEFT JOIN v_hoa_don hd ON hd.maphieudt = pdt.maphieudt
       WHERE pk.mabn = $1
       ORDER BY pdt.thoigian DESC`,
      [maBN]
    );

    res.json({
      benhNhan: {
        maBN: bn.mabn,
        hoTen: bn.hoten,
        ngaySinh: bn.ngaysinh ? bn.ngaysinh.toISOString().split('T')[0] : null,
        tuoi: bn.tuoi,
        gioiTinh: bn.gioitinh,
        cccd: bn.cccd,
        soDienThoai: bn.sodienthoai,
        diaChi: bn.diachi,
        soTheBHYT: bn.sothebhyt,
        nhomMau: bn.nhommau,
        tienSuDiUng: bn.tiensudiung,
      },
      dotDieuTri: dotsRes.rows.map((d) => ({
        maCDDT: d.madot,
        maDot: d.madot,
        maPhieuKham: d.maphieukham,
        ngayBatDau: d.ngaybatdau ? d.ngaybatdau.toISOString().split('T')[0] : null,
        maBenh: d.mabenh,
        tenBenh: d.tenbenh,
        mucDo: d.mucdo,
        soLanChuaCanThiet: d.solanchuacanthiet,
        soLanDaChua: d.solandachua,
        ngayKetThuc: d.ngayketthuc ? d.ngayketthuc.toISOString().split('T')[0] : null,
        trangThai: d.trangthai,
        maKhoa: d.makhoa,
        tenKhoa: d.tenkhoa,
        maBS: d.mabs,
        tenBS: d.tenbs,
      })),
      phieuKham: pkRes.rows.map((k) => ({
        maLuot: k.maphieukham,
        thoiGian: k.thoigian.toISOString(),
        loaiLuot: 'KHAM',
        lyDoKham: k.lydokham,
        trieuChung: k.trieuchung,
        ketLuanKham: k.ketluankham,
        ngayHenTaiKham: k.ngayhentaikham ? k.ngayhentaikham.toISOString().split('T')[0] : null,
        ghiChu: k.ghichu,
        maBS: k.mabs,
        tenBS: k.tenbs,
        maKhoa: k.makhoa,
        tenKhoa: k.tenkhoa,
        tongTien: parseFloat(k.tongtien || 0),
        maHD: k.mahd,
        trangThaiHoaDon: k.trangthaihoadon,
      })),
      phieuDieuTri: pdtRes.rows.map((c) => ({
        maLuot: c.maphieudt,
        thoiGian: c.thoigian.toISOString(),
        loaiLuot: 'CHUA',
        maCDDT: c.madot,
        maDot: c.madot,
        tenBenh: c.tenbenh,
        lanThu: c.lanthu,
        ketLuanSauChua: c.ketluansauchua,
        tinhTrangSauChua: c.tinhtrangsauchua,
        ngayHenTaiKham: c.ngayhentaikham ? c.ngayhentaikham.toISOString().split('T')[0] : null,
        ghiChu: c.ghichu,
        maBS: c.mabs,
        tenBS: c.tenbs,
        maKhoa: c.makhoa,
        tenKhoa: c.tenkhoa,
        tongTien: parseFloat(c.tongtien || 0),
        maHD: c.mahd,
        trangThaiHoaDon: c.trangthaihoadon,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 7. CÁC ĐỢT ĐANG ĐIỀU TRỊ CỦA BỆNH NHÂN
// ==========================================
export async function getActiveTreatmentDots(req, res, next) {
  try {
    const { maBN } = req.params;
    const result = await query(
      `SELECT d.madot, d.maphieukham, pk.thoigian AS ngaybatdau,
              d.mabenh, b.tenbenh, d.mucdo, d.solanchuacanthiet,
              (SELECT COUNT(*)::int FROM phieu_dieu_tri WHERE madot = d.madot) AS solandachua,
              d.ngayketthuc, d.trangthai,
              nv.makhoa, k.tenkhoa, pk.mabs, nv.hoten AS tenbs
       FROM dot_dieu_tri d
       JOIN benh b ON b.mabenh = d.mabenh
       JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
       JOIN nhan_vien nv ON nv.manv = pk.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       WHERE pk.mabn = $1 AND d.trangthai = 'Đang điều trị'
       ORDER BY pk.thoigian DESC`,
      [maBN]
    );

    const data = result.rows.map((d) => ({
      maCDDT: d.madot,
      maDot: d.madot,
      maPhieuKham: d.maphieukham,
      ngayBatDau: d.ngaybatdau.toISOString().split('T')[0],
      maBenh: d.mabenh,
      tenBenh: d.tenbenh,
      mucDo: d.mucdo,
      soLanChuaCanThiet: d.solanchuacanthiet,
      soLanDaChua: d.solandachua,
      trangThai: d.trangthai,
      maKhoa: d.makhoa,
      tenKhoa: d.tenkhoa,
      maBS: d.mabs,
      tenBS: d.tenbs,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
}
