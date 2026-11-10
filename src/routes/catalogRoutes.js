import { Router } from 'express';
import {
  getBranches, updateBranch,
  getKhoa, createKhoa, updateKhoa, deleteKhoa,
  getBacSi, createBacSi, updateBacSi, deleteBacSi,
  getYTa, createYTa, updateYTa, deleteYTa,
  getThietBi, createThietBi, updateThietBi, deleteThietBi,
  getThuoc, createThuoc, updateThuoc, deleteThuoc,
  getBenh, createBenh, updateBenh, deleteBenh,
  getDichVu, createDichVu, updateDichVu, deleteDichVu,
  getLuongCoSo, createLuongCoSo, updateLuongCoSo, deleteLuongCoSo,
} from '../controllers/catalogController.js';

const router = Router();

// Chi nhánh
router.get('/chi-nhanh', getBranches);
router.get('/master/chi-nhanh', getBranches);
router.put('/master/chi-nhanh/:maCn', updateBranch);

// Khoa
router.get('/khoa', getKhoa);
router.post('/khoa', createKhoa);
router.put('/khoa/:maKhoa', updateKhoa);
router.delete('/khoa/:maKhoa', deleteKhoa);

// Bác sĩ
router.get('/bac-si', getBacSi);
router.post('/bac-si', createBacSi);
router.put('/bac-si/:maNV', updateBacSi);
router.delete('/bac-si/:maNV', deleteBacSi);

// Y tá
router.get('/y-ta', getYTa);
router.post('/y-ta', createYTa);
router.put('/y-ta/:maNV', updateYTa);
router.delete('/y-ta/:maNV', deleteYTa);

// Thiết bị
router.get('/thiet-bi', getThietBi);
router.post('/thiet-bi', createThietBi);
router.put('/thiet-bi/:maTB', updateThietBi);
router.delete('/thiet-bi/:maTB', deleteThietBi);

// Thuốc
router.get('/thuoc', getThuoc);
router.get('/master/thuoc', getThuoc);
router.post('/master/thuoc', createThuoc);
router.put('/master/thuoc/:ma', updateThuoc);
router.delete('/master/thuoc/:ma', deleteThuoc);

// Bệnh
router.get('/benh', getBenh);
router.get('/master/benh', getBenh);
router.post('/master/benh', createBenh);
router.put('/master/benh/:ma', updateBenh);
router.delete('/master/benh/:ma', deleteBenh);

// Dịch vụ
router.get('/dich-vu', getDichVu);
router.get('/master/dich-vu', getDichVu);
router.post('/master/dich-vu', createDichVu);
router.put('/master/dich-vu/:ma', updateDichVu);
router.delete('/master/dich-vu/:ma', deleteDichVu);

// Lương cơ sở
router.get('/luong-co-so', getLuongCoSo);
router.get('/master/luong-co-so', getLuongCoSo);
router.post('/master/luong-co-so', createLuongCoSo);
router.put('/master/luong-co-so/:ngayApDung', updateLuongCoSo);
router.delete('/master/luong-co-so/:ngayApDung', deleteLuongCoSo);

export default router;
