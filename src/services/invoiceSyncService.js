import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { publishEvent, TOPICS } from './kafkaService.js';

/**
 * Build rich, denormalized invoice document from PostgreSQL
 */
export async function buildInvoicePayload(maHD) {
  const hdRes = await query(
    `SELECT hd.mahd, hd.ngaylap, hd.giamtru, hd.maphieu, hd.loaiphieu,
            hd.tongtien, hd.phaitra, hd.datra, (hd.phaitra - hd.datra) AS conthieu, hd.trangthai,
            bn.mabn, bn.hoten AS tenbn, bn.sodienthoai, bn.ngaysinh, bn.gioitinh,
            nv.manv AS mabs, nv.hoten AS tenbs,
            k.makhoa, k.tenkhoa, k.macn
     FROM v_hoa_don hd
     LEFT JOIN phieu_kham pk ON pk.maphieukham = hd.maphieu
     LEFT JOIN phieu_dieu_tri pdt ON pdt.maphieudt = hd.maphieu
     LEFT JOIN dot_dieu_tri d ON d.madot = pdt.madot
     LEFT JOIN phieu_kham pk_dot ON pk_dot.maphieukham = d.maphieukham
     JOIN benh_nhan bn ON bn.mabn = COALESCE(pk.mabn, pk_dot.mabn)
     JOIN nhan_vien nv ON nv.manv = COALESCE(pk.mabs, pdt.mabs)
     JOIN khoa k ON k.makhoa = nv.makhoa
     WHERE hd.mahd = $1`,
    [maHD]
  );

  if (hdRes.rows.length === 0) return null;
  const hd = hdRes.rows[0];

  // 1. Lịch sử thanh toán
  const ttRes = await query(
    `SELECT stt, thoigian, sotien, hinhthuc 
     FROM lan_thanh_toan 
     WHERE mahd = $1 
     ORDER BY stt ASC`,
    [maHD]
  );

  // 2. Chi tiết chi phí của phiếu
  const cpRes = await query(
    `SELECT loaichiphi, mamathang, tenmathang, soluong, dongiaapdung, thanhtien
     FROM v_chi_tiet_chi_phi_phieu
     WHERE maphieu = $1
     ORDER BY loaichiphi, mamathang`,
    [hd.maphieu]
  );

  const tongTien = parseFloat(hd.tongtien);
  const giamTru = parseFloat(hd.giamtru);
  const phaiTra = parseFloat(hd.phaitra);
  const daTra = parseFloat(hd.datra);
  const conThieu = Math.max(0, parseFloat(hd.conthieu));

  return {
    maHD: hd.mahd,
    site: hd.macn || env.siteCode,
    siteName: env.siteName,
    ngayLap: hd.ngaylap ? hd.ngaylap.toISOString() : new Date().toISOString(),
    maPhieu: hd.maphieu,
    loaiPhieu: hd.loaiphieu,
    maBN: hd.mabn,
    tenBN: hd.tenbn,
    soDienThoai: hd.sodienthoai,
    gioiTinh: hd.gioitinh,
    ngaySinh: hd.ngaysinh ? hd.ngaysinh.toISOString().split('T')[0] : null,
    maBS: hd.mabs,
    tenBS: hd.tenbs,
    maKhoa: hd.makhoa,
    tenKhoa: hd.tenkhoa,
    tongTien,
    giamTru,
    soTienPhaiTra: phaiTra,
    daThanhToan: daTra,
    conThieu,
    trangThai: hd.trangthai,
    isDaThuHet: conThieu === 0,
    chiTietKhoan: cpRes.rows.map((c) => ({
      loaiChiPhi: c.loaichiphi,
      maMatHang: c.mamathang,
      tenMatHang: c.tenmathang,
      soLuong: c.soluong,
      donGia: parseFloat(c.dongiaapdung),
      thanhTien: parseFloat(c.thanhtien),
    })),
    lanThanhToan: ttRes.rows.map((t) => ({
      stt: t.stt,
      thoiGian: t.thoigian ? t.thoigian.toISOString() : new Date().toISOString(),
      soTien: parseFloat(t.sotien),
      hinhThuc: t.hinhthuc,
    })),
  };
}

/**
 * Asynchronously publish invoice to Kafka (non-blocking)
 */
export function syncInvoiceToMongo(maHD) {
  setImmediate(async () => {
    try {
      const payload = await buildInvoicePayload(maHD);
      if (payload) {
        publishEvent(TOPICS.INVOICE_EVENTS, payload);
      }
    } catch (err) {
      console.warn(`[Invoice Sync Warning] Could not prepare invoice ${maHD} for Kafka:`, err.message);
    }
  });
}

/**
 * Bulk sync all existing invoices from PostgreSQL to MongoDB
 */
export async function syncAllInvoicesToMongo() {
  const result = await query('SELECT mahd FROM hoa_don ORDER BY ngaylap ASC');
  let synced = 0;
  for (const row of result.rows) {
    try {
      const payload = await buildInvoicePayload(row.mahd);
      if (payload) {
        publishEvent(TOPICS.INVOICE_EVENTS, payload);
        synced++;
      }
    } catch (err) {
      console.warn(`[Bulk Sync Warning] Failed to sync ${row.mahd}:`, err.message);
    }
  }
  return { total: result.rows.length, synced };
}

