import { Router } from 'express';
import { getInvoices, getInvoiceDetail, createPayment } from '../controllers/invoiceController.js';

const router = Router();

router.get('/', getInvoices);
router.get('/:maHD', getInvoiceDetail);
router.post('/:maHD/thanh-toan', createPayment);

export default router;

