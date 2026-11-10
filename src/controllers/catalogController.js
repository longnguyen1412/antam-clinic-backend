import { query, withTransaction } from '../config/database.js';
import { env } from '../config/env.js';

// ==========================================
// 1. CHI NHÁNH
// ==========================================
export async function getBranches(req, res, next) {
  try {
    const result = await query('SELECT macn, tencn, diachi, sodienthoai FROM chi_nhanh ORDER BY macn');
    const branches = result.rows.map((row) => {
      const site = row.macn === 'CN1' ? 'S1' : row.macn === 'CN2' ? 'S2' : row.macn === 'CN3' ? 'S3' : 'S0';
      return {
        site,
        maCn: row.macn,
        tenCn: row.tencn,
        shortName: row.tencn.replace('Phòng khám Đa khoa ', ''),
        diaChi: row.diachi,
        soDienThoai: row.sodienthoai,
        jdbcUrl: `jdbc:postgresql://localhost:${5430 + parseInt(row.macn.replace('CN', '') || '0', 10)}/ql_phongkham_${row.macn.toLowerCase()}`,
        inDatabase: true,
      };
    });
    res.json(branches);
  } catch (err) {
    next(err);
  }
}

export async function updateBranch(req, res, next) {
  try {
    const { maCn } = req.params;
    const { tenCn, diaChi, soDienThoai } = req.body;
    await query(
      `UPDATE chi_nhanh 
       SET tencn = COALESCE($1, tencn), 
           diachi = COALESCE($2, diachi), 
           sodienthoai = COALESCE($3, sodienthoai) 
       WHERE macn = $4`,
      [tenCn, diaChi, soDienThoai, maCn]
    );
    res.json({ message: 'Cập nhật chi nhánh thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 2. KHOA
// ==========================================
export async function getKhoa(req, res, next) {
  try {
    const sql = `
      SELECT k.makhoa, k.tenkhoa, k.mota, k.macn,
             COUNT(DISTINCT nv.manv)::int AS sonhanvien,
             (
               SELECT COUNT(*)::int FROM (
                 SELECT pk.maphieukham FROM phieu_kham pk 
                 JOIN bac_si bs ON bs.manv = pk.mabs 
                 JOIN nhan_vien nv2 ON nv2.manv = bs.manv 
                 WHERE nv2.makhoa = k.makhoa
                 UNION ALL
                 SELECT pdt.maphieudt FROM phieu_dieu_tri pdt 
                 JOIN bac_si bs ON bs.manv = pdt.mabs 
                 JOIN nhan_vien nv2 ON nv2.manv = bs.manv 
                 WHERE nv2.makhoa = k.makhoa
               ) all_luot
             ) AS soluot
      FROM khoa k
      LEFT JOIN nhan_vien nv ON nv.makhoa = k.makhoa
      GROUP BY k.makhoa, k.tenkhoa, k.mota, k.macn
      ORDER BY k.makhoa
    `;
    const result = await query(sql);
    const data = result.rows.map((r) => ({
      maKhoa: r.makhoa,
      tenKhoa: r.tenkhoa,
      moTa: r.mota,
      maCn: r.macn,
      soNhanVien: r.sonhanvien,
      soLuot: r.soluot,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createKhoa(req, res, next) {
  try {
    const { maKhoa, tenKhoa, moTa } = req.body;
    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';
    const finalMaKhoa = maKhoa || `${branchPrefix}-${tenKhoa.toUpperCase().replace(/\s+/g, '')}`;
    await query(
      `INSERT INTO khoa (makhoa, tenkhoa, mota, macn) VALUES ($1, $2, $3, $4)`,
      [finalMaKhoa, tenKhoa, moTa || null, branchPrefix]
    );
    res.json({ maKhoa: finalMaKhoa, tenKhoa, moTa, maCn: branchPrefix, soNhanVien: 0, soLuot: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateKhoa(req, res, next) {
  try {
    const { maKhoa } = req.params;
    const { tenKhoa, moTa } = req.body;
    await query(
      `UPDATE khoa SET tenkhoa = $1, mota = $2 WHERE makhoa = $3`,
      [tenKhoa, moTa || null, maKhoa]
    );
    res.json({ maKhoa, tenKhoa, moTa });
  } catch (err) {
    next(err);
  }
}

export async function deleteKhoa(req, res, next) {
  try {
    const { maKhoa } = req.params;
    await query('DELETE FROM khoa WHERE makhoa = $1', [maKhoa]);
    res.json({ mode: 'HARD', message: 'Đã xóa khoa thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 3. BÁC SĨ (BAC_SI + NHAN_VIEN + NV_SODIENTHOAI)
// ==========================================
export async function getBacSi(req, res, next) {
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
             (
               SELECT COUNT(*)::int FROM (
                 SELECT maphieukham FROM phieu_kham WHERE mabs = nv.manv
                 UNION ALL
                 SELECT maphieudt FROM phieu_dieu_tri WHERE mabs = nv.manv
               ) all_v
             ) AS soluot
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
      sql += ` AND (nv.hoten ILIKE $${params.length} OR nv.manv ILIKE $${params.length} OR bs.chuyenkhoa ILIKE $${params.length})`;
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

export async function createBacSi(req, res, next) {
  try {
    const {
      maNV, hoTen, ngaySinh, gioiTinh, cccd, diaChi,
      heSoLuong, ngayVaoLam, trangThai, maKhoa,
      chuyenKhoa, hocVi, soChungChiHanhNghe, soDienThoai = []
    } = req.body;

    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';

    const result = await withTransaction(async (client) => {
      let finalMaNV = maNV;
      if (!finalMaNV) {
        const countRes = await client.query(
          "SELECT COUNT(*)::int AS count FROM bac_si WHERE manv LIKE $1",
          [`BS-${branchPrefix}-%`]
        );
        const nextId = String(countRes.rows[0].count + 1).padStart(2, '0');
        finalMaNV = `BS-${branchPrefix}-${nextId}`;
      }

      // 1. Insert NHAN_VIEN
      await client.query(
        `INSERT INTO nhan_vien (manv, hoten, ngaysinh, gioitinh, cccd, diachi, hesoluong, ngayvaolam, trangthai, loainv, makhoa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Bác sĩ', $10)`,
        [finalMaNV, hoTen, ngaySinh || null, gioiTinh || 'Khác', cccd || null, diaChi || null,
         heSoLuong || 2.34, ngayVaoLam || new Date(), trangThai || 'Đang làm việc', maKhoa]
      );

      // 2. Insert BAC_SI
      await client.query(
        `INSERT INTO bac_si (manv, chuyenkhoa, hocvi, sochungchihanhnghe)
         VALUES ($1, $2, $3, $4)`,
        [finalMaNV, chuyenKhoa || 'Đa khoa', hocVi || 'Bác sĩ', soChungChiHanhNghe || null]
      );

      // 3. Insert phone numbers
      if (Array.isArray(soDienThoai)) {
        for (const phone of soDienThoai) {
          if (phone && phone.trim()) {
            await client.query(
              `INSERT INTO nv_sodienthoai (manv, sodienthoai) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [finalMaNV, phone.trim()]
            );
          }
        }
      }

      return finalMaNV;
    });

    res.json({ maNV: result, message: 'Tạo bác sĩ thành công' });
  } catch (err) {
    next(err);
  }
}

export async function updateBacSi(req, res, next) {
  try {
    const { maNV } = req.params;
    const {
      hoTen, ngaySinh, gioiTinh, cccd, diaChi,
      heSoLuong, ngayVaoLam, trangThai, maKhoa,
      chuyenKhoa, hocVi, soChungChiHanhNghe, soDienThoai
    } = req.body;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE nhan_vien 
         SET hoten = COALESCE($1, hoten),
             ngaysinh = COALESCE($2, ngaysinh),
             gioitinh = COALESCE($3, gioitinh),
             cccd = COALESCE($4, cccd),
             diachi = COALESCE($5, diachi),
             hesoluong = COALESCE($6, hesoluong),
             ngayvaolam = COALESCE($7, ngayvaolam),
             trangthai = COALESCE($8, trangthai),
             makhoa = COALESCE($9, makhoa)
         WHERE manv = $10`,
        [hoTen, ngaySinh || null, gioiTinh, cccd || null, diaChi || null,
         heSoLuong, ngayVaoLam || null, trangThai, maKhoa, maNV]
      );

      await client.query(
        `UPDATE bac_si 
         SET chuyenkhoa = COALESCE($1, chuyenkhoa),
             hocvi = COALESCE($2, hocvi),
             sochungchihanhnghe = COALESCE($3, sochungchihanhnghe)
         WHERE manv = $4`,
        [chuyenKhoa, hocVi, soChungChiHanhNghe || null, maNV]
      );

      if (Array.isArray(soDienThoai)) {
        await client.query('DELETE FROM nv_sodienthoai WHERE manv = $1', [maNV]);
        for (const phone of soDienThoai) {
          if (phone && phone.trim()) {
            await client.query(
              `INSERT INTO nv_sodienthoai (manv, sodienthoai) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [maNV, phone.trim()]
            );
          }
        }
      }
    });

    res.json({ maNV, message: 'Cập nhật bác sĩ thành công' });
  } catch (err) {
    next(err);
  }
}

export async function deleteBacSi(req, res, next) {
  try {
    const { maNV } = req.params;
    // Check if doctor has visits
    const checkRes = await query(
      `SELECT (
         SELECT COUNT(*) FROM phieu_kham WHERE mabs = $1
       ) + (
         SELECT COUNT(*) FROM phieu_dieu_tri WHERE mabs = $1
       ) AS count`,
      [maNV]
    );

    if (parseInt(checkRes.rows[0].count, 10) > 0) {
      // Soft delete: set status to 'Ngừng làm việc'
      await query("UPDATE nhan_vien SET trangthai = 'Ngừng làm việc' WHERE manv = $1", [maNV]);
      return res.json({ mode: 'SOFT', message: 'Bác sĩ đã phát sinh phiếu khám/chữa. Đã chuyển trạng thái sang "Ngừng làm việc".' });
    }

    // Hard delete
    await withTransaction(async (client) => {
      await client.query('DELETE FROM nv_sodienthoai WHERE manv = $1', [maNV]);
      await client.query('DELETE FROM bac_si WHERE manv = $1', [maNV]);
      await client.query('DELETE FROM nhan_vien WHERE manv = $1', [maNV]);
    });

    res.json({ mode: 'HARD', message: 'Đã xóa bác sĩ thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 4. Y TÁ (Y_TA + NHAN_VIEN + NV_SODIENTHOAI)
// ==========================================
export async function getYTa(req, res, next) {
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
             (
               SELECT COUNT(*)::int FROM (
                 SELECT mayt FROM ho_tro_kham WHERE mayt = nv.manv
                 UNION ALL
                 SELECT mayt FROM ho_tro_chua WHERE mayt = nv.manv
               ) all_ht
             ) AS solanhotro
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

export async function createYTa(req, res, next) {
  try {
    const {
      maNV, hoTen, ngaySinh, gioiTinh, cccd, diaChi,
      heSoLuong, ngayVaoLam, trangThai, maKhoa,
      trinhDo, soChungChiHanhNghe, soDienThoai = []
    } = req.body;

    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';

    const result = await withTransaction(async (client) => {
      let finalMaNV = maNV;
      if (!finalMaNV) {
        const countRes = await client.query(
          "SELECT COUNT(*)::int AS count FROM y_ta WHERE manv LIKE $1",
          [`YT-${branchPrefix}-%`]
        );
        const nextId = String(countRes.rows[0].count + 1).padStart(2, '0');
        finalMaNV = `YT-${branchPrefix}-${nextId}`;
      }

      await client.query(
        `INSERT INTO nhan_vien (manv, hoten, ngaysinh, gioitinh, cccd, diachi, hesoluong, ngayvaolam, trangthai, loainv, makhoa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Y tá', $10)`,
        [finalMaNV, hoTen, ngaySinh || null, gioiTinh || 'Khác', cccd || null, diaChi || null,
         heSoLuong || 1.86, ngayVaoLam || new Date(), trangThai || 'Đang làm việc', maKhoa]
      );

      await client.query(
        `INSERT INTO y_ta (manv, trinhdo, sochungchihanhnghe) VALUES ($1, $2, $3)`,
        [finalMaNV, trinhDo || 'Cao đẳng Điều dưỡng', soChungChiHanhNghe || null]
      );

      if (Array.isArray(soDienThoai)) {
        for (const phone of soDienThoai) {
          if (phone && phone.trim()) {
            await client.query(
              `INSERT INTO nv_sodienthoai (manv, sodienthoai) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [finalMaNV, phone.trim()]
            );
          }
        }
      }

      return finalMaNV;
    });

    res.json({ maNV: result, message: 'Tạo y tá thành công' });
  } catch (err) {
    next(err);
  }
}

export async function updateYTa(req, res, next) {
  try {
    const { maNV } = req.params;
    const {
      hoTen, ngaySinh, gioiTinh, cccd, diaChi,
      heSoLuong, ngayVaoLam, trangThai, maKhoa,
      trinhDo, soChungChiHanhNghe, soDienThoai
    } = req.body;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE nhan_vien 
         SET hoten = COALESCE($1, hoten),
             ngaysinh = COALESCE($2, ngaysinh),
             gioitinh = COALESCE($3, gioitinh),
             cccd = COALESCE($4, cccd),
             diachi = COALESCE($5, diachi),
             hesoluong = COALESCE($6, hesoluong),
             ngayvaolam = COALESCE($7, ngayvaolam),
             trangthai = COALESCE($8, trangthai),
             makhoa = COALESCE($9, makhoa)
         WHERE manv = $10`,
        [hoTen, ngaySinh || null, gioiTinh, cccd || null, diaChi || null,
         heSoLuong, ngayVaoLam || null, trangThai, maKhoa, maNV]
      );

      await client.query(
        `UPDATE y_ta 
         SET trinhdo = COALESCE($1, trinhdo),
             sochungchihanhnghe = COALESCE($2, sochungchihanhnghe)
         WHERE manv = $3`,
        [trinhDo, soChungChiHanhNghe || null, maNV]
      );

      if (Array.isArray(soDienThoai)) {
        await client.query('DELETE FROM nv_sodienthoai WHERE manv = $1', [maNV]);
        for (const phone of soDienThoai) {
          if (phone && phone.trim()) {
            await client.query(
              `INSERT INTO nv_sodienthoai (manv, sodienthoai) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [maNV, phone.trim()]
            );
          }
        }
      }
    });

    res.json({ maNV, message: 'Cập nhật y tá thành công' });
  } catch (err) {
    next(err);
  }
}

export async function deleteYTa(req, res, next) {
  try {
    const { maNV } = req.params;
    const checkRes = await query(
      `SELECT (
         SELECT COUNT(*) FROM ho_tro_kham WHERE mayt = $1
       ) + (
         SELECT COUNT(*) FROM ho_tro_chua WHERE mayt = $1
       ) AS count`,
      [maNV]
    );

    if (parseInt(checkRes.rows[0].count, 10) > 0) {
      await query("UPDATE nhan_vien SET trangthai = 'Ngừng làm việc' WHERE manv = $1", [maNV]);
      return res.json({ mode: 'SOFT', message: 'Y tá đã phát sinh hỗ trợ khám/chữa. Đã chuyển trạng thái sang "Ngừng làm việc".' });
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM nv_sodienthoai WHERE manv = $1', [maNV]);
      await client.query('DELETE FROM y_ta WHERE manv = $1', [maNV]);
      await client.query('DELETE FROM nhan_vien WHERE manv = $1', [maNV]);
    });

    res.json({ mode: 'HARD', message: 'Đã xóa y tá thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 5. THIẾT BỊ (THIET_BI)
// ==========================================
export async function getThietBi(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `
      SELECT tb.matb, tb.tentb, tb.loaitb, tb.dongiasudung, tb.ngaymua, tb.tinhtrang, tb.macn,
             (SELECT COUNT(*)::int FROM su_dung_tb WHERE matb = tb.matb) AS solansudung
      FROM thiet_bi tb
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (tb.tentb ILIKE $1 OR tb.matb ILIKE $1 OR tb.loaitb ILIKE $1)`;
    }
    sql += ` ORDER BY tb.matb`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maTB: r.matb,
      tenTB: r.tentb,
      loaiTB: r.loaitb,
      donGiaSuDung: parseFloat(r.dongiasudung),
      ngayMua: r.ngaymua ? r.ngaymua.toISOString().split('T')[0] : null,
      tinhTrang: r.tinhtrang,
      maCn: r.macn,
      soLanSuDung: r.solansudung,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createThietBi(req, res, next) {
  try {
    const { maTB, tenTB, loaiTB, donGiaSuDung, ngayMua, tinhTrang } = req.body;
    const branchPrefix = env.siteCode === 'S2' ? 'CN2' : env.siteCode === 'S3' ? 'CN3' : 'CN1';
    let finalMaTB = maTB;
    if (!finalMaTB) {
      const cRes = await query("SELECT COUNT(*)::int AS count FROM thiet_bi WHERE matb LIKE $1", [`TB-${branchPrefix}-%`]);
      finalMaTB = `TB-${branchPrefix}-${String(cRes.rows[0].count + 1).padStart(3, '0')}`;
    }

    await query(
      `INSERT INTO thiet_bi (matb, tentb, loaitb, dongiasudung, ngaymua, tinhtrang, macn)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [finalMaTB, tenTB, loaiTB || null, donGiaSuDung || 0, ngayMua || new Date(), tinhTrang || 'Tốt', branchPrefix]
    );

    res.json({ maTB: finalMaTB, tenTB, loaiTB, donGiaSuDung, ngayMua, tinhTrang, maCn: branchPrefix, soLanSuDung: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateThietBi(req, res, next) {
  try {
    const { maTB } = req.params;
    const { tenTB, loaiTB, donGiaSuDung, ngayMua, tinhTrang } = req.body;
    await query(
      `UPDATE thiet_bi 
       SET tentb = COALESCE($1, tentb),
           loaitb = COALESCE($2, loaitb),
           dongiasudung = COALESCE($3, dongiasudung),
           ngaymua = COALESCE($4, ngaymua),
           tinhtrang = COALESCE($5, tinhtrang)
       WHERE matb = $6`,
      [tenTB, loaiTB, donGiaSuDung, ngayMua || null, tinhTrang, maTB]
    );
    res.json({ maTB, message: 'Cập nhật thiết bị thành công' });
  } catch (err) {
    next(err);
  }
}

export async function deleteThietBi(req, res, next) {
  try {
    const { maTB } = req.params;
    const check = await query('SELECT COUNT(*)::int AS count FROM su_dung_tb WHERE matb = $1', [maTB]);
    if (check.rows[0].count > 0) {
      await query("UPDATE thiet_bi SET tinhtrang = 'Ngừng hoạt động' WHERE matb = $1", [maTB]);
      return res.json({ mode: 'SOFT', message: 'Thiết bị đã được sử dụng. Đã đổi tình trạng sang "Ngừng hoạt động".' });
    }
    await query('DELETE FROM thiet_bi WHERE matb = $1', [maTB]);
    res.json({ mode: 'HARD', message: 'Đã xóa thiết bị thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 6. THUỐC (THUOC)
// ==========================================
export async function getThuoc(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `
      SELECT t.mathuoc, t.tenthuoc, t.hoatchat, t.donvitinh, t.dongia, t.hangsx,
             (
               SELECT COUNT(*)::int FROM (
                 SELECT mathuoc FROM ke_don WHERE mathuoc = t.mathuoc
                 UNION ALL
                 SELECT mathuoc FROM dung_thuoc WHERE mathuoc = t.mathuoc
               ) all_k
             ) AS solanke
      FROM thuoc t
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (t.tenthuoc ILIKE $1 OR t.hoatchat ILIKE $1 OR t.mathuoc ILIKE $1)`;
    }
    sql += ` ORDER BY t.tenthuoc`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maThuoc: r.mathuoc,
      tenThuoc: r.tenthuoc,
      hoatChat: r.hoatchat,
      donViTinh: r.donvitinh,
      donGia: parseFloat(r.dongia),
      hangSX: r.hangsx,
      soLanKe: r.solanke,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createThuoc(req, res, next) {
  try {
    const { maThuoc, tenThuoc, hoatChat, donViTinh, donGia, hangSX } = req.body;
    let finalMa = maThuoc;
    if (!finalMa) {
      const cRes = await query("SELECT COUNT(*)::int AS count FROM thuoc");
      finalMa = `T${String(cRes.rows[0].count + 1).padStart(3, '0')}`;
    }
    await query(
      `INSERT INTO thuoc (mathuoc, tenthuoc, hoatchat, donvitinh, dongia, hangsx)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [finalMa, tenThuoc, hoatChat || null, donViTinh || 'Viên', donGia || 0, hangSX || null]
    );
    res.json({ maThuoc: finalMa, tenThuoc, hoatChat, donViTinh, donGia, hangSX, soLanKe: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateThuoc(req, res, next) {
  try {
    const { ma } = req.params;
    const { tenThuoc, hoatChat, donViTinh, donGia, hangSX } = req.body;
    await query(
      `UPDATE thuoc 
       SET tenthuoc = COALESCE($1, tenthuoc),
           hoatchat = COALESCE($2, hoatchat),
           donvitinh = COALESCE($3, donvitinh),
           dongia = COALESCE($4, dongia),
           hangsx = COALESCE($5, hangsx)
       WHERE mathuoc = $6`,
      [tenThuoc, hoatChat, donViTinh, donGia, hangSX, ma]
    );
    res.json({ maThuoc: ma, tenThuoc, hoatChat, donViTinh, donGia, hangSX });
  } catch (err) {
    next(err);
  }
}

export async function deleteThuoc(req, res, next) {
  try {
    const { ma } = req.params;
    await query('DELETE FROM thuoc WHERE mathuoc = $1', [ma]);
    res.json({ mode: 'HARD', message: 'Đã xóa thuốc thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 7. BỆNH (BENH)
// ==========================================
export async function getBenh(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `
      SELECT b.mabenh, b.tenbenh, b.maicd10, b.mota,
             (SELECT COUNT(*)::int FROM dot_dieu_tri WHERE mabenh = b.mabenh) AS solanmac
      FROM benh b
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (b.tenbenh ILIKE $1 OR b.mabenh ILIKE $1 OR b.maicd10 ILIKE $1)`;
    }
    sql += ` ORDER BY b.tenbenh`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maBenh: r.mabenh,
      tenBenh: r.tenbenh,
      maICD10: r.maicd10,
      moTa: r.mota,
      soLanMac: r.solanmac,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createBenh(req, res, next) {
  try {
    const { maBenh, tenBenh, maICD10, moTa } = req.body;
    let finalMa = maBenh;
    if (!finalMa) {
      const cRes = await query("SELECT COUNT(*)::int AS count FROM benh");
      finalMa = `B${String(cRes.rows[0].count + 1).padStart(3, '0')}`;
    }
    await query(
      `INSERT INTO benh (mabenh, tenbenh, maicd10, mota) VALUES ($1, $2, $3, $4)`,
      [finalMa, tenBenh, maICD10 || null, moTa || null]
    );
    res.json({ maBenh: finalMa, tenBenh, maICD10, moTa, soLanMac: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateBenh(req, res, next) {
  try {
    const { ma } = req.params;
    const { tenBenh, maICD10, moTa } = req.body;
    await query(
      `UPDATE benh SET tenbenh = COALESCE($1, tenbenh), maicd10 = COALESCE($2, maicd10), mota = COALESCE($3, mota) WHERE mabenh = $4`,
      [tenBenh, maICD10, moTa, ma]
    );
    res.json({ maBenh: ma, tenBenh, maICD10, moTa });
  } catch (err) {
    next(err);
  }
}

export async function deleteBenh(req, res, next) {
  try {
    const { ma } = req.params;
    await query('DELETE FROM benh WHERE mabenh = $1', [ma]);
    res.json({ mode: 'HARD', message: 'Đã xóa bệnh thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 8. DỊCH VỤ (DICH_VU)
// ==========================================
export async function getDichVu(req, res, next) {
  try {
    const { q } = req.query;
    let sql = `
      SELECT dv.madv, dv.tendv, dv.loaidv, dv.dongia, dv.mota,
             (
               SELECT COUNT(*)::int FROM (
                 SELECT madv FROM dv_kham WHERE madv = dv.madv
                 UNION ALL
                 SELECT madv FROM dv_chua WHERE madv = dv.madv
               ) all_dv
             ) AS solansudung
      FROM dich_vu dv
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (dv.tendv ILIKE $1 OR dv.madv ILIKE $1 OR dv.loaidv ILIKE $1)`;
    }
    sql += ` ORDER BY dv.tendv`;

    const result = await query(sql, params);
    const data = result.rows.map((r) => ({
      maDV: r.madv,
      tenDV: r.tendv,
      loaiDV: r.loaidv,
      donGia: parseFloat(r.dongia),
      moTa: r.mota,
      soLanSuDung: r.solansudung,
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createDichVu(req, res, next) {
  try {
    const { maDV, tenDV, loaiDV, donGia, moTa } = req.body;
    let finalMa = maDV;
    if (!finalMa) {
      const cRes = await query("SELECT COUNT(*)::int AS count FROM dich_vu");
      finalMa = `DV${String(cRes.rows[0].count + 1).padStart(2, '0')}`;
    }
    await query(
      `INSERT INTO dich_vu (madv, tendv, loaidv, dongia, mota) VALUES ($1, $2, $3, $4, $5)`,
      [finalMa, tenDV, loaiDV || 'Khám bệnh', donGia || 0, moTa || null]
    );
    res.json({ maDV: finalMa, tenDV, loaiDV, donGia, moTa, soLanSuDung: 0 });
  } catch (err) {
    next(err);
  }
}

export async function updateDichVu(req, res, next) {
  try {
    const { ma } = req.params;
    const { tenDV, loaiDV, donGia, moTa } = req.body;
    await query(
      `UPDATE dich_vu 
       SET tendv = COALESCE($1, tendv),
           loaidv = COALESCE($2, loaidv),
           dongia = COALESCE($3, dongia),
           mota = COALESCE($4, mota)
       WHERE madv = $5`,
      [tenDV, loaiDV, donGia, moTa, ma]
    );
    res.json({ maDV: ma, tenDV, loaiDV, donGia, moTa });
  } catch (err) {
    next(err);
  }
}

export async function deleteDichVu(req, res, next) {
  try {
    const { ma } = req.params;
    await query('DELETE FROM dich_vu WHERE madv = $1', [ma]);
    res.json({ mode: 'HARD', message: 'Đã xóa dịch vụ thành công' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// 9. LƯƠNG CƠ SỞ (LUONG_CO_SO)
// ==========================================
export async function getLuongCoSo(req, res, next) {
  try {
    const result = await query('SELECT ngayapdung, mucluong, vanbanquydinh FROM luong_co_so ORDER BY ngayapdung DESC');
    const now = new Date();
    const data = result.rows.map((r, idx) => {
      const d = new Date(r.ngayapdung);
      let trangThai = 'DA_THAY_THE';
      if (d > now) {
        trangThai = 'SAP_AP_DUNG';
      } else if (idx === 0 || (idx > 0 && new Date(result.rows[0].ngayapdung) > now && idx === 1)) {
        trangThai = 'DANG_AP_DUNG';
      }
      return {
        ngayApDung: r.ngayapdung.toISOString().split('T')[0],
        mucLuong: parseFloat(r.mucluong),
        vanBanQuyDinh: r.vanbanquydinh,
        trangThai,
      };
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createLuongCoSo(req, res, next) {
  try {
    const { ngayApDung, mucLuong, vanBanQuyDinh } = req.body;
    await query(
      `INSERT INTO luong_co_so (ngayapdung, mucluong, vanbanquydinh) VALUES ($1, $2, $3)`,
      [ngayApDung, mucLuong, vanBanQuyDinh || null]
    );
    res.json({ ngayApDung, mucLuong, vanBanQuyDinh, trangThai: 'DANG_AP_DUNG' });
  } catch (err) {
    next(err);
  }
}

export async function updateLuongCoSo(req, res, next) {
  try {
    const { ngayApDung } = req.params;
    const { mucLuong, vanBanQuyDinh } = req.body;
    await query(
      `UPDATE luong_co_so SET mucluong = $1, vanbanquydinh = $2 WHERE ngayapdung = $3`,
      [mucLuong, vanBanQuyDinh || null, ngayApDung]
    );
    res.json({ ngayApDung, mucLuong, vanBanQuyDinh });
  } catch (err) {
    next(err);
  }
}

export async function deleteLuongCoSo(req, res, next) {
  try {
    const { ngayApDung } = req.params;
    await query('DELETE FROM luong_co_so WHERE ngayapdung = $1', [ngayApDung]);
    res.json({ mode: 'HARD', message: 'Đã xóa mốc lương cơ sở thành công' });
  } catch (err) {
    next(err);
  }
}
