import { query, withTransaction } from '../config/database.js';

// ==========================================
// 1. DANH SÁCH HÓA ĐƠN (GET /api/hoa-don)
// ==========================================
export async function getInvoices(req, res, next) {
  try {
    const { trangThai, tu, den, q } = req.query;

    let sql = `
      SELECT hd.mahd, hd.ngaylap, hd.giamtru, hd.maphieu, hd.loaiphieu,
             hd.tongtien, hd.phaitra, hd.datra, (hd.phaitra - hd.datra) AS conthieu, hd.trangthai,
             bn.mabn, bn.hoten AS tenbn, nv.hoten AS tenbs
      FROM v_hoa_don hd
      LEFT JOIN phieu_kham pk ON pk.maphieukham = hd.maphieu
      LEFT JOIN phieu_dieu_tri pdt ON pdt.maphieudt = hd.maphieu
      LEFT JOIN dot_dieu_tri d ON d.madot = pdt.madot
      LEFT JOIN phieu_kham pk_dot ON pk_dot.maphieukham = d.maphieukham
      JOIN benh_nhan bn ON bn.mabn = COALESCE(pk.mabn, pk_dot.mabn)
      JOIN nhan_vien nv ON nv.manv = COALESCE(pk.mabs, pdt.mabs)
      WHERE 1=1
    `;
    const params = [];
    if (trangThai) {
      params.push(trangThai);
      sql += ` AND hd.trangthai = $${params.length}`;
    }
    if (tu) {
      params.push(tu);
      sql += ` AND hd.ngaylap::date >= $${params.length}`;
    }
    if (den) {
      params.push(den);
      sql += ` AND hd.ngaylap::date <= $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (hd.mahd ILIKE $${params.length} OR hd.maphieu ILIKE $${params.length} OR bn.hoten ILIKE $${params.length} OR bn.mabn ILIKE $${params.length})`;
    }

    sql += ` ORDER BY hd.ngaylap DESC`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maHD: r.mahd,
      ngayLap: r.ngaylap.toISOString(),
      giamTru: parseFloat(r.giamtru),
      maPhieu: r.maphieu,
      loaiPhieu: r.loaiphieu,
      tongTien: parseFloat(r.tongtien),
      soTienPhaiTra: parseFloat(r.phaitra),
      daThu: parseFloat(r.datra),
      conThieu: Math.max(0, parseFloat(r.conthieu)),
      trangThai: r.trangthai,
      maBN: r.mabn,
      tenBN: r.tenbn,
      tenBS: r.tenbs,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 2. CHI TIẾT HÓA ĐƠN (GET /api/hoa-don/:maHD)
// ==========================================
export async function getInvoiceDetail(req, res, next) {
  try {
    const { maHD } = req.params;

    const hdRes = await query(
      `SELECT hd.mahd, hd.ngaylap, hd.giamtru, hd.maphieu, hd.loaiphieu,
              hd.tongtien, hd.phaitra, hd.datra, (hd.phaitra - hd.datra) AS conthieu, hd.trangthai,
              bn.mabn, bn.hoten AS tenbn, bn.sodienthoai, nv.hoten AS tenbs
       FROM v_hoa_don hd
       LEFT JOIN phieu_kham pk ON pk.maphieukham = hd.maphieu
       LEFT JOIN phieu_dieu_tri pdt ON pdt.maphieudt = hd.maphieu
       LEFT JOIN dot_dieu_tri d ON d.madot = pdt.madot
       LEFT JOIN phieu_kham pk_dot ON pk_dot.maphieukham = d.maphieukham
       JOIN benh_nhan bn ON bn.mabn = COALESCE(pk.mabn, pk_dot.mabn)
       JOIN nhan_vien nv ON nv.manv = COALESCE(pk.mabs, pdt.mabs)
       WHERE hd.mahd = $1`,
      [maHD]
    );

    if (hdRes.rows.length === 0) {
      return res.status(404).json({ status: 404, message: `Không tìm thấy hóa đơn ${maHD}` });
    }
    const hd = hdRes.rows[0];

    // Lịch sử các lần thanh toán
    const ttRes = await query(
      `SELECT stt, thoigian, sotien, hinhthuc 
       FROM lan_thanh_toan 
       WHERE mahd = $1 
       ORDER BY stt ASC`,
      [maHD]
    );

    // Chi tiết chi phí của phiếu tương ứng
    const cpRes = await query(
      `SELECT loaichiphi, mamathang, tenmathang, soluong, dongiaapdung, thanhtien
       FROM v_chi_tiet_chi_phi_phieu
       WHERE maphieu = $1
       ORDER BY loaichiphi, mamathang`,
      [hd.maphieu]
    );

    res.json({
      hoaDon: {
        maHD: hd.mahd,
        ngayLap: hd.ngaylap.toISOString(),
        giamTru: parseFloat(hd.giamtru),
        maPhieu: hd.maphieu,
        loaiPhieu: hd.loaiphieu,
        tongTien: parseFloat(hd.tongtien),
        soTienPhaiTra: parseFloat(hd.phaitra),
        daThu: parseFloat(hd.datra),
        conThieu: Math.max(0, parseFloat(hd.conthieu)),
        trangThai: hd.trangthai,
        maBN: hd.mabn,
        tenBN: hd.tenbn,
        soDienThoai: hd.sodienthoai,
        tenBS: hd.tenbs,
      },
      lanThanhToan: ttRes.rows.map((t) => ({
        stt: t.stt,
        thoiGian: t.thoigian.toISOString(),
        soTien: parseFloat(t.sotien),
        hinhThuc: t.hinhthuc,
      })),
      chiTietChiPhi: cpRes.rows.map((c) => ({
        loaiChiPhi: c.loaichiphi,
        maMatHang: c.mamathang,
        tenMatHang: c.tenmathang,
        soLuong: c.soluong,
        donGia: parseFloat(c.dongiaapdung),
        thanhTien: parseFloat(c.thanhtien),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. THANH TOÁN HÓA ĐƠN (POST /api/hoa-don/:maHD/thanh-toan)
// ==========================================
export async function createPayment(req, res, next) {
  try {
    const { maHD } = req.params;
    const { soTien, hinhThuc = 'Tiền mặt' } = req.body;

    if (!soTien || parseFloat(soTien) <= 0) {
      return res.status(400).json({ status: 400, message: 'Số tiền thanh toán phải lớn hơn 0 (C9).' });
    }

    const payAmount = parseFloat(soTien);

    const result = await withTransaction(async (client) => {
      // 1. Kiểm tra hóa đơn và số tiền còn thiếu (C19)
      const hdRes = await client.query(
        'SELECT (phaitra - datra) AS conthieu, phaitra, datra, trangthai FROM v_hoa_don WHERE mahd = $1',
        [maHD]
      );
      if (hdRes.rows.length === 0) {
        throw new Error(`Hóa đơn ${maHD} không tồn tại.`);
      }
      const hd = hdRes.rows[0];
      const conThieu = parseFloat(hd.conthieu);

      if (payAmount > conThieu) {
        throw new Error(
          `Số tiền thanh toán (${payAmount.toLocaleString('vi-VN')} đ) vượt quá số tiền còn thiếu (${conThieu.toLocaleString('vi-VN')} đ) (C19).`
        );
      }

      // 2. Tính STT tăng liên tiếp từ 1 (C19)
      const sttRes = await client.query(
        'SELECT COALESCE(MAX(stt), 0) + 1 AS next_stt FROM lan_thanh_toan WHERE mahd = $1',
        [maHD]
      );
      const nextSTT = sttRes.rows[0].next_stt;

      // 3. INSERT LAN_THANH_TOAN
      await client.query(
        `INSERT INTO lan_thanh_toan (mahd, stt, thoigian, sotien, hinhthuc)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
        [maHD, nextSTT, payAmount, hinhThuc]
      );

      // 4. Lấy lại trạng thái sau thanh toán
      const afterRes = await client.query(
        'SELECT mahd, phaitra, datra, (phaitra - datra) AS conthieu, trangthai FROM v_hoa_don WHERE mahd = $1',
        [maHD]
      );
      return afterRes.rows[0];
    });

    res.json({
      maHD: result.mahd,
      soTienPhaiTra: parseFloat(result.phaitra),
      daThu: parseFloat(result.datra),
      conThieu: Math.max(0, parseFloat(result.conthieu)),
      trangThai: result.trangthai,
      message: 'Thanh toán thành công',
    });
  } catch (err) {
    next(err);
  }
}
