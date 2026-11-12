import { query, withTransaction } from '../config/database.js';
import { env } from '../config/env.js';
import { syncInvoiceToMongo } from '../services/invoiceSyncService.js';

// ==========================================
// 1. DANH SÁCH LƯỢT (GET /api/luot)
// ==========================================
export async function getVisits(req, res, next) {
  try {
    const { tu, den, loai, khoa, bs, q } = req.query;

    let sql = `
      WITH AllLuot AS (
        -- 1. Phiếu khám
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

        -- 2. Phiếu điều trị
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
      SELECT * FROM AllLuot WHERE 1=1
    `;

    const params = [];
    if (tu) {
      params.push(tu);
      sql += ` AND thoigian::date >= $${params.length}`;
    }
    if (den) {
      params.push(den);
      sql += ` AND thoigian::date <= $${params.length}`;
    }
    if (loai && (loai === 'KHAM' || loai === 'CHUA')) {
      params.push(loai);
      sql += ` AND loailuot = $${params.length}`;
    }
    if (khoa) {
      params.push(khoa);
      sql += ` AND makhoa = $${params.length}`;
    }
    if (bs) {
      params.push(bs);
      sql += ` AND mabs = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (maluot ILIKE $${params.length} OR tenbn ILIKE $${params.length} OR mabn ILIKE $${params.length} OR tenbs ILIKE $${params.length} OR benh ILIKE $${params.length})`;
    }

    sql += ` ORDER BY thoigian DESC`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
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

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 2. CHI TIẾT LƯỢT (GET /api/luot/:maLuot)
// ==========================================
export async function getVisitDetail(req, res, next) {
  try {
    const { maLuot } = req.params;
    const isKham = maLuot.startsWith('K-');

    let luot = null;
    let hinhThuc = [];
    let yTa = [];
    let dotDieuTri = [];
    let chiPhi = [];
    let luotChua = [];
    let phieuBoSung = [];
    let phieuGoc = null;

    if (isKham) {
      // 1. Phieu kham base
      const pkRes = await query(
        `SELECT pk.maphieukham AS maluot, pk.thoigian, 'KHAM' AS loailuot,
                pk.ngayhentaikham, pk.ghichu, nv.makhoa, k.tenkhoa, pk.mabs,
                nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn, pk.lydokham,
                pk.trieuchung, pk.ketluankham, pk.maphieugoc,
                COALESCE(cp.tiendichvu, 0) AS tiendichvu,
                COALESCE(cp.tienthuoc, 0) AS tienthuoc,
                COALESCE(cp.tienthietbi, 0) AS tienthietbi,
                COALESCE(cp.tongtien, 0) AS tongtien
         FROM phieu_kham pk
         JOIN benh_nhan bn ON bn.mabn = pk.mabn
         JOIN nhan_vien nv ON nv.manv = pk.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
         WHERE pk.maphieukham = $1`,
        [maLuot]
      );
      if (pkRes.rows.length === 0) {
        return res.status(404).json({ status: 404, message: `Không tìm thấy phiếu khám ${maLuot}` });
      }
      const r = pkRes.rows[0];
      luot = {
        maLuot: r.maluot,
        thoiGian: r.thoigian.toISOString(),
        loaiLuot: 'KHAM',
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
        maCDDT: null,
        lanThu: null,
        ketLuanSauChua: null,
        tinhTrangSauChua: null,
        benh: null,
        hinhThucChua: null,
        yTaHoTro: null,
        tienDichVu: parseFloat(r.tiendichvu),
        tienThuoc: parseFloat(r.tienthuoc),
        tienThietBi: parseFloat(r.tienthietbi),
        tongTien: parseFloat(r.tongtien),
      };

      // Y tá hỗ trợ khám
      const ytRes = await query(
        `SELECT htk.mayt, nv.hoten, htk.vaitro
         FROM ho_tro_kham htk
         JOIN nhan_vien nv ON nv.manv = htk.mayt
         WHERE htk.maphieukham = $1`,
        [maLuot]
      );
      yTa = ytRes.rows.map((y) => ({ maYT: y.mayt, hoTen: y.hoten, vaiTro: y.vaitro }));

      // Đợt điều trị mở từ phiếu khám này
      const dotRes = await query(
        `SELECT td.madot, td.maphieukham, td.ngaybatdau, td.mabenh, td.tenbenh,
                td.mucdo, td.solanchuacanthiet, td.solandachua, td.ngayketthuc, td.trangthai,
                k.makhoa, k.tenkhoa, pk.mabs, nv.hoten AS tenbs, pk.mabn
         FROM v_tien_trinh_dot td
         JOIN phieu_kham pk ON pk.maphieukham = td.maphieukham
         JOIN nhan_vien nv ON nv.manv = pk.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         WHERE td.maphieukham = $1
         ORDER BY td.madot`,
        [maLuot]
      );
      dotDieuTri = dotRes.rows.map((d) => ({
        maCDDT: d.madot,
        maDot: d.madot,
        maBN: d.mabn,
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
      }));

      // Các lượt chữa của những đợt mở từ lượt này
      const lcRes = await query(
        `SELECT pdt.maphieudt AS maluot, pdt.thoigian, 'CHUA' AS loailuot,
                pdt.ngayhentaikham, pdt.ghichu, nv.makhoa, k.tenkhoa, pdt.mabs,
                nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn,
                pdt.madot AS macddt, pdt.lanthu, pdt.ketluansauchua, pdt.tinhtrangsauchua,
                b.tenbenh AS benh,
                COALESCE(cp.tongtien, 0) AS tongtien
         FROM phieu_dieu_tri pdt
         JOIN dot_dieu_tri d ON d.madot = pdt.madot
         JOIN benh b ON b.mabenh = d.mabenh
         JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
         JOIN benh_nhan bn ON bn.mabn = pk.mabn
         JOIN nhan_vien nv ON nv.manv = pdt.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pdt.maphieudt
         WHERE d.maphieukham = $1
         ORDER BY pdt.thoigian ASC`,
        [maLuot]
      ).catch(async () => {
        // Fallback standard query without helper view
        return query(
          `SELECT pdt.maphieudt AS maluot, pdt.thoigian, 'CHUA' AS loailuot,
                  pdt.ngayhentaikham, pdt.ghichu, nv.makhoa, k.tenkhoa, pdt.mabs,
                  nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn,
                  pdt.madot AS macddt, pdt.lanthu, pdt.ketluansauchua, pdt.tinhtrangsauchua,
                  b.tenbenh AS benh,
                  COALESCE(cp.tongtien, 0) AS tongtien
           FROM phieu_dieu_tri pdt
           JOIN dot_dieu_tri d ON d.madot = pdt.madot
           JOIN benh b ON b.mabenh = d.mabenh
           JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
           JOIN benh_nhan bn ON bn.mabn = pk.mabn
           JOIN nhan_vien nv ON nv.manv = pdt.mabs
           JOIN khoa k ON k.makhoa = nv.makhoa
           LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pdt.maphieudt
           WHERE d.maphieukham = $1
           ORDER BY pdt.thoigian ASC`,
          [maLuot]
        );
      });
      luotChua = lcRes.rows.map((c) => ({
        maLuot: c.maluot,
        thoiGian: c.thoigian.toISOString(),
        loaiLuot: 'CHUA',
        ngayHenTaiKham: c.ngayhentaikham ? c.ngayhentaikham.toISOString().split('T')[0] : null,
        ghiChu: c.ghichu,
        maKhoa: c.makhoa,
        tenKhoa: c.tenkhoa,
        maBS: c.mabs,
        tenBS: c.tenbs,
        maBN: c.mabn,
        tenBN: c.tenbn,
        maCDDT: c.macddt,
        lanThu: c.lanthu,
        ketLuanSauChua: c.ketluansauchua,
        tinhTrangSauChua: c.tinhtrangsauchua,
        benh: c.benh,
        tongTien: parseFloat(c.tongtien),
      }));

      // Các phiếu khám bổ sung mở từ phiếu khám này
      const bsRes = await query(
        `SELECT pk.maphieukham AS maluot, pk.thoigian, 'KHAM' AS loailuot,
                pk.ngayhentaikham, pk.ghichu, nv.makhoa, k.tenkhoa, pk.mabs,
                nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn, pk.lydokham,
                pk.trieuchung, pk.ketluankham, pk.maphieugoc,
                COALESCE(cp.tongtien, 0) AS tongtien
         FROM phieu_kham pk
         JOIN benh_nhan bn ON bn.mabn = pk.mabn
         JOIN nhan_vien nv ON nv.manv = pk.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
         WHERE pk.maphieugoc = $1
         ORDER BY pk.thoigian ASC`,
        [maLuot]
      );
      phieuBoSung = bsRes.rows.map((b) => ({
        maLuot: b.maluot,
        thoiGian: b.thoigian.toISOString(),
        loaiLuot: 'KHAM',
        ngayHenTaiKham: b.ngayhentaikham ? b.ngayhentaikham.toISOString().split('T')[0] : null,
        ghiChu: b.ghichu,
        maKhoa: b.makhoa,
        tenKhoa: b.tenkhoa,
        maBS: b.mabs,
        tenBS: b.tenbs,
        maBN: b.mabn,
        tenBN: b.tenbn,
        lyDoKham: b.lydokham,
        trieuChung: b.trieuchung,
        ketLuanKham: b.ketluankham,
        maPhieuGoc: b.maphieugoc,
        tongTien: parseFloat(b.tongtien),
      }));

      // Nếu đây là phiếu khám bổ sung, lấy thông tin phiếu gốc
      if (r.maphieugoc) {
        const pgRes = await query(
          `SELECT pk.maphieukham AS maluot, pk.thoigian, 'KHAM' AS loailuot,
                  pk.ngayhentaikham, pk.ghichu, nv.makhoa, k.tenkhoa, pk.mabs,
                  nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn, pk.lydokham,
                  pk.trieuchung, pk.ketluankham,
                  COALESCE(cp.tongtien, 0) AS tongtien
           FROM phieu_kham pk
           JOIN benh_nhan bn ON bn.mabn = pk.mabn
           JOIN nhan_vien nv ON nv.manv = pk.mabs
           JOIN khoa k ON k.makhoa = nv.makhoa
           LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
           WHERE pk.maphieukham = $1`,
          [r.maphieugoc]
        );
        if (pgRes.rows.length > 0) {
          const pg = pgRes.rows[0];
          phieuGoc = {
            maLuot: pg.maluot,
            thoiGian: pg.thoigian.toISOString(),
            loaiLuot: 'KHAM',
            ngayHenTaiKham: pg.ngayhentaikham ? pg.ngayhentaikham.toISOString().split('T')[0] : null,
            ghiChu: pg.ghichu,
            maKhoa: pg.makhoa,
            tenKhoa: pg.tenkhoa,
            maBS: pg.mabs,
            tenBS: pg.tenbs,
            maBN: pg.mabn,
            tenBN: pg.tenbn,
            lyDoKham: pg.lydokham,
            trieuChung: pg.trieuchung,
            ketLuanKham: pg.ketluankham,
            tongTien: parseFloat(pg.tongtien),
          };
        }
      }
    } else {
      // 2. Phieu dieu tri base
      const pdtRes = await query(
        `SELECT pdt.maphieudt AS maluot, pdt.thoigian, 'CHUA' AS loailuot,
                pdt.ngayhentaikham, pdt.ghichu, nv.makhoa, k.tenkhoa, pdt.mabs,
                nv.hoten AS tenbs, pk.mabn, bn.hoten AS tenbn,
                pdt.madot AS macddt, pdt.lanthu, pdt.ketluansauchua, pdt.tinhtrangsauchua,
                b.tenbenh AS benh,
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
         WHERE pdt.maphieudt = $1`,
        [maLuot]
      );
      if (pdtRes.rows.length === 0) {
        return res.status(404).json({ status: 404, message: `Không tìm thấy phiếu điều trị ${maLuot}` });
      }
      const r = pdtRes.rows[0];
      luot = {
        maLuot: r.maluot,
        thoiGian: r.thoigian.toISOString(),
        loaiLuot: 'CHUA',
        ngayHenTaiKham: r.ngayhentaikham ? r.ngayhentaikham.toISOString().split('T')[0] : null,
        ghiChu: r.ghichu,
        maKhoa: r.makhoa,
        tenKhoa: r.tenkhoa,
        maBS: r.mabs,
        tenBS: r.tenbs,
        maBN: r.mabn,
        tenBN: r.tenbn,
        lyDoKham: null,
        trieuChung: null,
        ketLuanKham: null,
        maCDDT: r.macddt,
        lanThu: r.lanthu,
        ketLuanSauChua: r.ketluansauchua,
        tinhTrangSauChua: r.tinhtrangsauchua,
        benh: r.benh,
        hinhThucChua: null,
        yTaHoTro: null,
        tienDichVu: parseFloat(r.tiendichvu),
        tienThuoc: parseFloat(r.tienthuoc),
        tienThietBi: parseFloat(r.tienthietbi),
        tongTien: parseFloat(r.tongtien),
      };

      // Hình thức điều trị
      const htRes = await query('SELECT hinhthuc FROM pdt_hinh_thuc WHERE maphieudt = $1', [maLuot]);
      hinhThuc = htRes.rows.map((h) => h.hinhthuc);

      // Y tá hỗ trợ chữa
      const ytRes = await query(
        `SELECT htc.mayt, nv.hoten, htc.vaitro
         FROM ho_tro_chua htc
         JOIN nhan_vien nv ON nv.manv = htc.mayt
         WHERE htc.maphieudt = $1`,
        [maLuot]
      );
      yTa = ytRes.rows.map((y) => ({ maYT: y.mayt, hoTen: y.hoten, vaiTro: y.vaitro }));

      // Đợt điều trị của phiếu này
      const dotRes = await query(
        `SELECT td.madot, td.maphieukham, td.ngaybatdau, td.mabenh, td.tenbenh,
                td.mucdo, td.solanchuacanthiet, td.solandachua, td.ngayketthuc, td.trangthai,
                k.makhoa, k.tenkhoa, pk.mabs, nv.hoten AS tenbs, pk.mabn
         FROM v_tien_trinh_dot td
         JOIN phieu_kham pk ON pk.maphieukham = td.maphieukham
         JOIN nhan_vien nv ON nv.manv = pk.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         WHERE td.madot = $1`,
        [r.macddt]
      );
      dotDieuTri = dotRes.rows.map((d) => ({
        maCDDT: d.madot,
        maDot: d.madot,
        maBN: d.mabn,
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
      }));
    }

    // Chi tiết chi phí từ V_CHI_TIET_CHI_PHI_PHIEU
    const cpRes = await query(
      `SELECT loaichiphi, mamathang, tenmathang, soluong, dongiaapdung, thanhtien
       FROM v_chi_tiet_chi_phi_phieu
       WHERE maphieu = $1
       ORDER BY loaichiphi, mamathang`,
      [maLuot]
    );

    // Bổ sung ketQua cho DV hoặc lieuDung cho Thuốc
    const dvKetQuaMap = {};
    const thuocLieuDungMap = {};
    if (isKham) {
      const dvRes = await query('SELECT madv, ketqua FROM dv_kham WHERE maphieukham = $1', [maLuot]);
      dvRes.rows.forEach((d) => { dvKetQuaMap[d.madv] = d.ketqua; });
      const thRes = await query('SELECT mathuoc, lieudung FROM ke_don WHERE maphieukham = $1', [maLuot]);
      thRes.rows.forEach((t) => { thuocLieuDungMap[t.mathuoc] = t.lieudung; });
    } else {
      const dvRes = await query('SELECT madv, ketqua FROM dv_chua WHERE maphieudt = $1', [maLuot]);
      dvRes.rows.forEach((d) => { dvKetQuaMap[d.madv] = d.ketqua; });
    }

    chiPhi = cpRes.rows.map((c) => ({
      loai: c.loaichiphi,
      ma: c.mamathang,
      ten: c.tenmathang,
      soLuong: c.soluong,
      donGia: parseFloat(c.dongiaapdung),
      thanhTien: parseFloat(c.thanhtien),
      ketQua: dvKetQuaMap[c.mamathang] || null,
      lieuDung: thuocLieuDungMap[c.mamathang] || null,
    }));

    // Kiểm tra quyền xóa (BR9: không xóa phiếu nếu hóa đơn đã có thanh toán)
    const ttCheck = await query(
      `SELECT COUNT(*)::int AS count 
       FROM lan_thanh_toan lt
       JOIN hoa_don hd ON hd.mahd = lt.mahd
       WHERE hd.maphieukham = $1 OR hd.maphieudt = $1`,
      [maLuot]
    );
    const daThanhToan = ttCheck.rows[0].count > 0;
    const xoaDuoc = !daThanhToan;
    const lyDoKhongXoa = daThanhToan ? 'Hóa đơn của phiếu đã phát sinh lần thanh toán.' : null;

    res.json({
      luot,
      hinhThuc,
      yTa,
      dotDieuTri,
      chiPhi,
      xoaDuoc,
      lyDoKhongXoa,
      luotChua,
      suaDuoc: true,
      lyDoKhongSua: null,
      phieuBoSung,
      phieuGoc,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. TẠO LƯỢT KHÁM (POST /api/luot-kham)
// ==========================================
export async function createLuotKham(req, res, next) {
  try {
    // Theo quy định của hệ thống: Phiếu khám (PHIEU_KHAM) chỉ có dịch vụ khám/CLS (DV_KHAM)
    // và đơn thuốc (KE_DON), KHÔNG sử dụng thiết bị y tế (thiết bị chỉ dùng cho phiếu điều trị - SU_DUNG_TB).
    const {
      maBN, maKhoa, maBS, thoiGian, lyDoKham, trieuChung, ghiChu, maPhieuGoc,
      chanDoan = [], yTa = [], dichVu = [], thuoc = []
    } = req.body;

    const result = await withTransaction(async (client) => {
      // 1. Kiểm tra bác sĩ & khoa (BR6)
      const bsRes = await client.query(
        `SELECT nv.manv, nv.hoten, nv.makhoa, k.macn 
         FROM bac_si bs 
         JOIN nhan_vien nv ON nv.manv = bs.manv 
         JOIN khoa k ON k.makhoa = nv.makhoa
         WHERE bs.manv = $1 AND nv.trangthai = 'Đang làm việc'`,
        [maBS]
      );
      if (bsRes.rows.length === 0) {
        throw new Error(`Bác sĩ ${maBS} không tồn tại hoặc không trong trạng thái đang làm việc.`);
      }
      const actualKhoa = bsRes.rows[0].makhoa;
      const branchCode = bsRes.rows[0].macn; // CN1, CN2, CN3

      // 1.1. Kiểm tra phiếu gốc nếu là khám bổ sung (C20)
      let validMaPhieuGoc = null;
      let tgDate = thoiGian ? new Date(thoiGian) : new Date();

      if (maPhieuGoc) {
        const pgCheck = await client.query(
          'SELECT maphieukham, mabn, thoigian, maphieugoc FROM phieu_kham WHERE maphieukham = $1',
          [maPhieuGoc]
        );
        if (pgCheck.rows.length === 0) {
          throw new Error(`Phiếu khám gốc "${maPhieuGoc}" không tồn tại (C20).`);
        }
        const pg = pgCheck.rows[0];
        if (pg.mabn !== maBN) {
          throw new Error(`Phiếu khám bổ sung phải cùng bệnh nhân (${pg.mabn}) với phiếu gốc (C20).`);
        }
        if (pg.maphieugoc) {
          throw new Error(`Phiếu gốc "${maPhieuGoc}" không được là một phiếu khám bổ sung khác (C20).`);
        }
        const tgGoc = new Date(pg.thoigian);
        if (tgDate <= tgGoc) {
          tgDate = new Date(tgGoc.getTime() + 60000); // Đảm bảo thời gian sau phiếu gốc
        }
        validMaPhieuGoc = pg.maphieukham;
      }

      // 2. Bắt buộc có dịch vụ loại 'Khám bệnh' (C8)
      let services = [...dichVu];
      const dvCheck = await client.query(
        `SELECT madv, loaidv, dongia FROM dich_vu WHERE madv = ANY($1)`,
        [services.map((s) => s.maDV)]
      );
      const hasKhamBenh = dvCheck.rows.some((d) => d.loaidv === 'Khám bệnh');
      if (!hasKhamBenh) {
        // Tự động gán dịch vụ khám bệnh mặc định
        const defaultKham = await client.query(
          "SELECT madv, dongia FROM dich_vu WHERE loaidv = 'Khám bệnh' ORDER BY madv LIMIT 1"
        );
        if (defaultKham.rows.length > 0) {
          services.unshift({
            maDV: defaultKham.rows[0].madv,
            soLuong: 1,
            ketQua: validMaPhieuGoc ? 'Khám bổ sung' : 'Khám thông thường',
          });
        }
      }

      // 3. Sinh mã phiếu khám: K-MaKhoa-MaBS-yyMMdd-NNN (BR5, C6)
      const yy = String(tgDate.getFullYear()).slice(-2);
      const mm = String(tgDate.getMonth() + 1).padStart(2, '0');
      const dd = String(tgDate.getDate()).padStart(2, '0');
      const datePrefix = `${yy}${mm}${dd}`;

      const seqRes = await client.query(
        `SELECT COUNT(*)::int AS count 
         FROM phieu_kham 
         WHERE mabs = $1 AND thoigian::date = $2`,
        [maBS, tgDate.toISOString().split('T')[0]]
      );
      const seq = String(seqRes.rows[0].count + 1).padStart(3, '0');
      const maPhieuKham = `K-${actualKhoa}-${maBS}-${datePrefix}-${seq}`;

      // 4. INSERT PHIEU_KHAM (kèm MaPhieuGoc nếu có)
      await client.query(
        `INSERT INTO phieu_kham (maphieukham, thoigian, lydokham, trieuchung, ketluankham, ghichu, mabn, mabs, maphieugoc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [maPhieuKham, tgDate, lyDoKham || null, trieuChung || null, null, ghiChu || null, maBN, maBS, validMaPhieuGoc]
      );

      // 5. INSERT HO_TRO_KHAM (C2: Bác sĩ và y tá phải cùng khoa)
      for (const yt of yTa) {
        if (yt.maYT) {
          const ytRes = await client.query('SELECT makhoa FROM nhan_vien WHERE manv = $1', [yt.maYT]);
          if (ytRes.rows.length > 0 && ytRes.rows[0].makhoa !== actualKhoa) {
            throw new Error(`C2: Y tá ${yt.maYT} (khoa ${ytRes.rows[0].makhoa}) không cùng khoa với bác sĩ ${maBS} (khoa ${actualKhoa}).`);
          }
          await client.query(
            `INSERT INTO ho_tro_kham (mayt, maphieukham, vaitro) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [yt.maYT, maPhieuKham, yt.vaiTro || 'Trợ khám']
          );
        }
      }

      // 6. INSERT DV_KHAM
      for (const s of services) {
        if (s.maDV) {
          const pRes = await client.query('SELECT dongia FROM dich_vu WHERE madv = $1', [s.maDV]);
          const donGia = pRes.rows.length > 0 ? pRes.rows[0].dongia : 0;
          await client.query(
            `INSERT INTO dv_kham (maphieukham, madv, soluong, dongiaapdung, ketqua)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (maphieukham, madv) DO UPDATE SET soluong = dv_kham.soluong + EXCLUDED.soluong`,
            [maPhieuKham, s.maDV, s.soLuong || 1, donGia, s.ketQua || null]
          );
        }
      }

      // 7. INSERT KE_DON (Thuốc kê đơn)
      for (const t of thuoc) {
        if (t.maThuoc) {
          const pRes = await client.query('SELECT dongia FROM thuoc WHERE mathuoc = $1', [t.maThuoc]);
          const donGia = pRes.rows.length > 0 ? pRes.rows[0].dongia : 0;
          await client.query(
            `INSERT INTO ke_don (maphieukham, mathuoc, soluong, lieudung, dongiaapdung)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (maphieukham, mathuoc) DO UPDATE SET soluong = ke_don.soluong + EXCLUDED.soluong`,
            [maPhieuKham, t.maThuoc, t.soLuong || 1, t.lieuDung || 'Theo chỉ định', donGia]
          );
        }
      }

      // 8. INSERT DOT_DIEU_TRI (Chẩn đoán mở đợt)
      const createdDots = [];
      for (const cd of chanDoan) {
        if (cd.maBenh) {
          const dotCountRes = await client.query(
            "SELECT COUNT(*)::int AS count FROM dot_dieu_tri WHERE madot LIKE $1",
            [`DOT-${branchCode}-%`]
          );
          const nextDotSeq = String(dotCountRes.rows[0].count + 1 + createdDots.length).padStart(3, '0');
          const maDot = `DOT-${branchCode}-${nextDotSeq}`;

          await client.query(
            `INSERT INTO dot_dieu_tri (madot, maphieukham, mabenh, mucdo, solanchuacanthiet, trangthai)
             VALUES ($1, $2, $3, $4, $5, 'Đang điều trị')`,
            [maDot, maPhieuKham, cd.maBenh, cd.mucDo || 'Trung bình', cd.soLanChuaCanThiet || 1]
          );
          createdDots.push(maDot);
        }
      }

      // 9. Sinh HÓA ĐƠN tự động (BR15, C18)
      const hdSeqRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM hoa_don WHERE mahd LIKE $1",
        [`HD-${branchCode}-${datePrefix}-%`]
      );
      const nextHdSeq = String(hdSeqRes.rows[0].count + 1).padStart(3, '0');
      const maHD = `HD-${branchCode}-${datePrefix}-${nextHdSeq}`;

      await client.query(
        `INSERT INTO hoa_don (mahd, ngaylap, giamtru, maphieukham)
         VALUES ($1, $2, 0, $3)`,
        [maHD, tgDate, maPhieuKham]
      );

      // 10. Lấy thông tin bệnh nhân & tổng tiền
      const bnRes = await client.query('SELECT hoten FROM benh_nhan WHERE mabn = $1', [maBN]);
      const tenBN = bnRes.rows.length > 0 ? bnRes.rows[0].hoten : null;

      const cpRes = await client.query(
        'SELECT COALESCE(tongtien, 0) AS tongtien FROM v_chi_phi_phieu WHERE maphieu = $1',
        [maPhieuKham]
      );
      const tongTien = cpRes.rows.length > 0 ? parseFloat(cpRes.rows[0].tongtien) : 0;

      return {
        maLuot: maPhieuKham,
        maHD,
        loaiLuot: 'KHAM',
        maBN,
        tenBN,
        maPhieuGoc: validMaPhieuGoc,
        maCDDT: createdDots,
        lanThu: null,
        tongTien,
        canhBao: [],
      };
    });

    if (result.maHD) {
      syncInvoiceToMongo(result.maHD);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 4. SỬA LƯỢT KHÁM (PUT /api/luot-kham/:maLuot)
// ==========================================
export async function updateLuotKham(req, res, next) {
  try {
    const { maLuot } = req.params;
    const { ketLuanKham, ngayHenTaiKham } = req.body;

    await query(
      `UPDATE phieu_kham 
       SET ketluankham = COALESCE($1, ketluankham),
           ngayhentaikham = COALESCE($2, ngayhentaikham)
       WHERE maphieukham = $3`,
      [ketLuanKham, ngayHenTaiKham || null, maLuot]
    );

    // Trả lại chi tiết sau khi sửa
    return getVisitDetail(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 5. THÊM CHẨN ĐOÁN (POST /api/luot-kham/:maLuot/chan-doan)
// ==========================================
export async function addDiagnosis(req, res, next) {
  try {
    const { maLuot } = req.params;
    const { maBenh, mucDo, soLanChuaCanThiet } = req.body;

    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';

    const result = await withTransaction(async (client) => {
      const dotCountRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM dot_dieu_tri WHERE madot LIKE $1",
        [`DOT-${branchPrefix}-%`]
      );
      const nextSeq = String(dotCountRes.rows[0].count + 1).padStart(3, '0');
      const maDot = `DOT-${branchPrefix}-${nextSeq}`;

      await client.query(
        `INSERT INTO dot_dieu_tri (madot, maphieukham, mabenh, mucdo, solanchuacanthiet, trangthai)
         VALUES ($1, $2, $3, $4, $5, 'Đang điều trị')`,
        [maDot, maLuot, maBenh, mucDo || 'Trung bình', soLanChuaCanThiet || 1]
      );

      const resRow = await client.query(
        `SELECT d.madot, d.maphieukham, d.mabenh, b.tenbenh, d.mucdo, d.solanchuacanthiet, d.trangthai
         FROM dot_dieu_tri d
         JOIN benh b ON b.mabenh = d.mabenh
         WHERE d.madot = $1`,
        [maDot]
      );
      return resRow.rows[0];
    });

    res.json({
      maCDDT: result.madot,
      maDot: result.madot,
      maPhieuKham: result.maphieukham,
      maBenh: result.mabenh,
      tenBenh: result.tenbenh,
      mucDo: result.mucdo,
      soLanChuaCanThiet: result.solanchuacanthiet,
      trangThai: result.trangthai,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 6. TẠO LƯỢT CHỮA (POST /api/luot-chua)
// ==========================================
export async function createLuotChua(req, res, next) {
  try {
    const {
      maCDDT, maKhoa, maBS, thoiGian, hinhThuc = [], ghiChu,
      yTa = [], dichVu = [], thuoc = [], thietBi = []
    } = req.body;

    const result = await withTransaction(async (client) => {
      // 1. Kiểm tra đợt điều trị (C3, C12, C13)
      const dotRes = await client.query(
        `SELECT d.madot, d.mabenh, d.trangthai, pk.mabn, pk.mabs AS mabs_kham, nv.makhoa, k.macn,
                (SELECT MAX(thoigian) FROM phieu_dieu_tri WHERE madot = d.madot) AS last_time
         FROM dot_dieu_tri d
         JOIN phieu_kham pk ON pk.maphieukham = d.maphieukham
         JOIN nhan_vien nv ON nv.manv = pk.mabs
         JOIN khoa k ON k.makhoa = nv.makhoa
         WHERE d.madot = $1`,
        [maCDDT]
      );

      if (dotRes.rows.length === 0) {
        throw new Error(`Đợt điều trị ${maCDDT} không tồn tại.`);
      }
      const dot = dotRes.rows[0];
      if (dot.trangthai !== 'Đang điều trị') {
        throw new Error(`Đợt điều trị ${maCDDT} đã ở trạng thái '${dot.trangthai}', không thể tiếp tục thêm lần chữa.`);
      }

      const branchCode = dot.macn;

      // 2. Tìm bác sĩ thực hiện & khoa (cho phép chọn bác sĩ trong cùng chi nhánh)
      let mabs_chua = null;
      let actualKhoa = null;

      if (maBS) {
        const bsRes = await client.query(
          `SELECT bs.manv, nv.makhoa, nv.trangthai, k.macn
           FROM bac_si bs
           JOIN nhan_vien nv ON nv.manv = bs.manv
           JOIN khoa k ON k.makhoa = nv.makhoa
           WHERE bs.manv = $1`,
          [maBS]
        );
        if (bsRes.rows.length === 0) {
          throw new Error(`Bác sĩ ${maBS} không tồn tại.`);
        }
        if (bsRes.rows[0].trangthai !== 'Đang làm việc') {
          throw new Error(`Bác sĩ ${maBS} không ở trạng thái 'Đang làm việc'.`);
        }
        if (bsRes.rows[0].macn !== branchCode) {
          throw new Error(`Bác sĩ ${maBS} không thuộc chi nhánh này (${branchCode}).`);
        }
        mabs_chua = bsRes.rows[0].manv;
        actualKhoa = bsRes.rows[0].makhoa;
      } else {
        const targetKhoa = maKhoa || dot.makhoa;
        const bsRes = await client.query(
          `SELECT bs.manv, nv.makhoa FROM bac_si bs
           JOIN nhan_vien nv ON nv.manv = bs.manv
           WHERE nv.makhoa = $1 AND nv.trangthai = 'Đang làm việc'
           ORDER BY (bs.manv = $2) DESC, bs.manv ASC LIMIT 1`,
          [targetKhoa, dot.mabs_kham]
        );
        if (bsRes.rows.length === 0) {
          throw new Error(`Không tìm thấy bác sĩ đang làm việc thuộc khoa ${targetKhoa} để thực hiện điều trị.`);
        }
        mabs_chua = bsRes.rows[0].manv;
        actualKhoa = bsRes.rows[0].makhoa;
      }

      // 3. Tính LanThu (C10): tăng liên tiếp từ 1
      const lanRes = await client.query(
        `SELECT COALESCE(MAX(lanthu), 0) + 1 AS next_lan FROM phieu_dieu_tri WHERE madot = $1`,
        [maCDDT]
      );
      const nextLanThu = lanRes.rows[0].next_lan;

      // 4. Sinh mã phiếu điều trị: C-MaKhoa-MaBS-yyMMdd-NNN (BR5, C6)
      const tgDate = thoiGian ? new Date(thoiGian) : new Date();
      const yy = String(tgDate.getFullYear()).slice(-2);
      const mm = String(tgDate.getMonth() + 1).padStart(2, '0');
      const dd = String(tgDate.getDate()).padStart(2, '0');
      const datePrefix = `${yy}${mm}${dd}`;

      const seqRes = await client.query(
        `SELECT COUNT(*)::int AS count 
         FROM phieu_dieu_tri 
         WHERE mabs = $1 AND thoigian::date = $2`,
        [mabs_chua, tgDate.toISOString().split('T')[0]]
      );
      const seq = String(seqRes.rows[0].count + 1).padStart(3, '0');
      const maPhieuDT = `C-${actualKhoa}-${mabs_chua}-${datePrefix}-${seq}`;

      // 5. INSERT PHIEU_DIEU_TRI
      await client.query(
        `INSERT INTO phieu_dieu_tri (maphieudt, thoigian, madot, mabs, lanthu, ghichu)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [maPhieuDT, tgDate, maCDDT, mabs_chua, nextLanThu, ghiChu || null]
      );

      // 6. INSERT PDT_HINH_THUC
      const forms = hinhThuc.length > 0 ? hinhThuc : ['Theo dõi'];
      for (const ht of forms) {
        await client.query(
          `INSERT INTO pdt_hinh_thuc (maphieudt, hinhthuc) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [maPhieuDT, ht]
        );
      }

      // 7. INSERT HO_TRO_CHUA (C2: Bác sĩ và y tá phải cùng khoa)
      for (const yt of yTa) {
        if (yt.maYT) {
          const ytRes = await client.query('SELECT makhoa FROM nhan_vien WHERE manv = $1', [yt.maYT]);
          if (ytRes.rows.length > 0 && ytRes.rows[0].makhoa !== actualKhoa) {
            throw new Error(`C2: Y tá ${yt.maYT} (khoa ${ytRes.rows[0].makhoa}) không cùng khoa với bác sĩ ${mabs_chua} (khoa ${actualKhoa}).`);
          }
          await client.query(
            `INSERT INTO ho_tro_chua (mayt, maphieudt, vaitro) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [yt.maYT, maPhieuDT, yt.vaiTro || 'Trợ chữa']
          );
        }
      }

      // 8. INSERT DV_CHUA (Tuyệt đối không có dịch vụ loại 'Khám bệnh' - C11)
      for (const s of dichVu) {
        if (s.maDV) {
          const dvInfo = await client.query('SELECT loaidv, dongia FROM dich_vu WHERE madv = $1', [s.maDV]);
          if (dvInfo.rows.length > 0) {
            if (dvInfo.rows[0].loaidv === 'Khám bệnh') {
              throw new Error(`Dịch vụ ${s.maDV} là loại 'Khám bệnh', không được phép có trong phiếu điều trị (C11, BR11).`);
            }
            await client.query(
              `INSERT INTO dv_chua (maphieudt, madv, soluong, dongiaapdung, ketqua)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (maphieudt, madv) DO UPDATE SET soluong = dv_chua.soluong + EXCLUDED.soluong`,
              [maPhieuDT, s.maDV, s.soLuong || 1, dvInfo.rows[0].dongia, s.ketQua || null]
            );
          }
        }
      }

      // 9. INSERT DUNG_THUOC (Thuốc dùng tại chỗ)
      for (const t of thuoc) {
        if (t.maThuoc) {
          const pRes = await client.query('SELECT dongia FROM thuoc WHERE mathuoc = $1', [t.maThuoc]);
          const donGia = pRes.rows.length > 0 ? pRes.rows[0].dongia : 0;
          await client.query(
            `INSERT INTO dung_thuoc (maphieudt, mathuoc, soluong, dongiaapdung)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (maphieudt, mathuoc) DO UPDATE SET soluong = dung_thuoc.soluong + EXCLUDED.soluong`,
            [maPhieuDT, t.maThuoc, t.soLuong || 1, donGia]
          );
        }
      }

      // 10. INSERT SU_DUNG_TB (Thiết bị)
      for (const tb of thietBi) {
        if (tb.maTB) {
          const pRes = await client.query('SELECT dongiasudung FROM thiet_bi WHERE matb = $1', [tb.maTB]);
          const donGia = pRes.rows.length > 0 ? pRes.rows[0].dongiasudung : 0;
          await client.query(
            `INSERT INTO su_dung_tb (maphieudt, matb, solan, dongiaapdung)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (maphieudt, matb) DO UPDATE SET solan = su_dung_tb.solan + EXCLUDED.solan`,
            [maPhieuDT, tb.maTB, tb.soLan || 1, donGia]
          );
        }
      }

      // 11. Sinh HÓA ĐƠN tự động cho phiếu điều trị (BR15, C18)
      const hdSeqRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM hoa_don WHERE mahd LIKE $1",
        [`HD-${branchCode}-${datePrefix}-%`]
      );
      const nextHdSeq = String(hdSeqRes.rows[0].count + 1).padStart(3, '0');
      const maHD = `HD-${branchCode}-${datePrefix}-${nextHdSeq}`;

      await client.query(
        `INSERT INTO hoa_don (mahd, ngaylap, giamtru, maphieudt)
         VALUES ($1, $2, 0, $3)`,
        [maHD, tgDate, maPhieuDT]
      );

      // 12. Lấy thông tin BN và tổng tiền
      const bnRes = await client.query('SELECT hoten FROM benh_nhan WHERE mabn = $1', [dot.mabn]);
      const tenBN = bnRes.rows.length > 0 ? bnRes.rows[0].hoten : null;

      const cpRes = await client.query(
        'SELECT COALESCE(tongtien, 0) AS tongtien FROM v_chi_phi_phieu WHERE maphieu = $1',
        [maPhieuDT]
      );
      const tongTien = cpRes.rows.length > 0 ? parseFloat(cpRes.rows[0].tongtien) : 0;

      return {
        maLuot: maPhieuDT,
        maHD,
        loaiLuot: 'CHUA',
        maBN: dot.mabn,
        tenBN,
        maCDDT: [maCDDT],
        lanThu: nextLanThu,
        tongTien,
        canhBao: [],
      };
    });

    if (result.maHD) {
      syncInvoiceToMongo(result.maHD);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 7. SỬA LƯỢT CHỮA (PUT /api/luot-chua/:maLuot)
// ==========================================
export async function updateLuotChua(req, res, next) {
  try {
    const { maLuot } = req.params;
    const { tinhTrangSauChua, ketLuanSauChua, soLanChuaCanThiet, ngayHenTaiKham } = req.body;

    await withTransaction(async (client) => {
      // 1. Cập nhật phiếu điều trị
      await client.query(
        `UPDATE phieu_dieu_tri 
         SET tinhtrangsauchua = COALESCE($1, tinhtrangsauchua),
             ketluansauchua = COALESCE($2, ketluansauchua),
             ngayhentaikham = $3
         WHERE maphieudt = $4`,
        [tinhTrangSauChua, ketLuanSauChua, ngayHenTaiKham || null, maLuot]
      );

      // 2. Lấy mã đợt
      const dotRes = await client.query('SELECT madot FROM phieu_dieu_tri WHERE maphieudt = $1', [maLuot]);
      if (dotRes.rows.length > 0) {
        const maDot = dotRes.rows[0].madot;

        if (tinhTrangSauChua === 'Khỏi') {
          // Trigger C5 đã tự động set 'Đã khỏi' và ngày kết thúc
          await client.query(
            `UPDATE dot_dieu_tri SET trangthai = 'Đã khỏi', ngayketthuc = CURRENT_DATE WHERE madot = $1`,
            [maDot]
          );
        } else if (soLanChuaCanThiet) {
          await client.query(
            `UPDATE dot_dieu_tri SET solanchuacanthiet = $1 WHERE madot = $2`,
            [soLanChuaCanThiet, maDot]
          );
        }
      }
    });

    return getVisitDetail(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 8. NGỪNG ĐIỀU TRỊ (PUT /api/dot-dieu-tri/:maCDDT/ngung)
// ==========================================
export async function stopTreatmentDot(req, res, next) {
  try {
    const { maCDDT } = req.params;
    await query(
      `UPDATE dot_dieu_tri 
       SET trangthai = 'Ngừng điều trị', ngayketthuc = CURRENT_DATE 
       WHERE madot = $1`,
      [maCDDT]
    );

    const result = await query(
      `SELECT d.madot, d.maphieukham, d.mabenh, b.tenbenh, d.mucdo, d.solanchuacanthiet, d.trangthai, d.ngayketthuc
       FROM dot_dieu_tri d
       JOIN benh b ON b.mabenh = d.mabenh
       WHERE d.madot = $1`,
      [maCDDT]
    );

    res.json({
      maCDDT: result.rows[0].madot,
      maDot: result.rows[0].madot,
      maPhieuKham: result.rows[0].maphieukham,
      maBenh: result.rows[0].mabenh,
      tenBenh: result.rows[0].tenbenh,
      mucDo: result.rows[0].mucdo,
      soLanChuaCanThiet: result.rows[0].solanchuacanthiet,
      trangThai: result.rows[0].trangthai,
      ngayKetThuc: result.rows[0].ngayketthuc,
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 9. XÓA LƯỢT (DELETE /api/luot/:maLuot)
// ==========================================
export async function deleteVisit(req, res, next) {
  try {
    const { maLuot } = req.params;
    const isKham = maLuot.startsWith('K-');

    // 1. Kiểm tra hóa đơn đã thanh toán chưa (BR9)
    const ttRes = await query(
      `SELECT COUNT(*)::int AS count 
       FROM lan_thanh_toan lt
       JOIN hoa_don hd ON hd.mahd = lt.mahd
       WHERE hd.maphieukham = $1 OR hd.maphieudt = $1`,
      [maLuot]
    );
    if (ttRes.rows[0].count > 0) {
      return res.status(400).json({
        status: 400,
        code: 'CANNOT_DELETE_PAID_VISIT',
        message: 'Không thể xóa lượt khám/chữa đã phát sinh thanh toán (BR9).',
      });
    }

    await withTransaction(async (client) => {
      // Xóa hóa đơn trước
      await client.query('DELETE FROM hoa_don WHERE maphieukham = $1 OR maphieudt = $1', [maLuot]);

      if (isKham) {
        // Xóa các đợt mở từ phiếu khám này (nếu chưa có phiếu điều trị nào)
        await client.query('DELETE FROM dot_dieu_tri WHERE maphieukham = $1', [maLuot]);
        // Xóa phiếu khám (ON DELETE CASCADE sẽ xóa DV_KHAM, KE_DON, HO_TRO_KHAM)
        await client.query('DELETE FROM phieu_kham WHERE maphieukham = $1', [maLuot]);
      } else {
        // Xóa phiếu điều trị (ON DELETE CASCADE sẽ xóa PDT_HINH_THUC, DV_CHUA, DUNG_THUOC, SU_DUNG_TB, HO_TRO_CHUA)
        await client.query('DELETE FROM phieu_dieu_tri WHERE maphieudt = $1', [maLuot]);
      }
    });

    res.json({ mode: 'HARD', message: `Đã xóa lượt ${maLuot} thành công` });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 10. DANH SÁCH PHIẾU KHÁM GỐC CỦA BỆNH NHÂN (GET /api/benh-nhan/:maBN/phieu-kham-goc)
// ==========================================
export async function getPhieuKhamGoc(req, res, next) {
  try {
    const maBN = req.params.maBN || req.query.maBN;
    if (!maBN) {
      return res.json([]);
    }
    const result = await query(
      `SELECT pk.maphieukham AS maluot, pk.thoigian, pk.mabs, nv.hoten AS tenbs,
              nv.makhoa, k.tenkhoa, pk.lydokham, pk.trieuchung, pk.ketluankham,
              (
                SELECT string_agg(b.tenbenh, ', ')
                FROM dot_dieu_tri d
                JOIN benh b ON b.mabenh = d.mabenh
                WHERE d.maphieukham = pk.maphieukham
              ) AS benh,
              COALESCE(cp.tongtien, 0) AS tongtien
       FROM phieu_kham pk
       JOIN nhan_vien nv ON nv.manv = pk.mabs
       JOIN khoa k ON k.makhoa = nv.makhoa
       LEFT JOIN v_chi_phi_phieu cp ON cp.maphieu = pk.maphieukham
       WHERE pk.mabn = $1 AND pk.maphieugoc IS NULL
       ORDER BY pk.thoigian DESC`,
      [maBN]
    );

    res.json(
      result.rows.map((r) => ({
        maLuot: r.maluot,
        thoiGian: r.thoigian.toISOString(),
        maBS: r.mabs,
        tenBS: r.tenbs,
        maKhoa: r.makhoa,
        tenKhoa: r.tenkhoa,
        lyDoKham: r.lydokham,
        trieuChung: r.trieuchung,
        ketLuanKham: r.ketluankham,
        benh: r.benh,
        tongTien: parseFloat(r.tongtien),
      }))
    );
  } catch (err) {
    next(err);
  }
}
