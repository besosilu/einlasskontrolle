import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/import.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV- oder TXT-Dateien sind erlaubt'));
    }
  },
});

router.post('/members', upload.array('files', 200), ctrl.importMembers);
router.get('/logs', ctrl.getLogs);
router.get('/logs/:id', ctrl.getLogById);
router.delete('/logs/:id', ctrl.deleteLog);

export default router;
