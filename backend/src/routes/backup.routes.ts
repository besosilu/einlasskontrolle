import { Router } from 'express';
import * as ctrl from '../controllers/backup.controller.js';

const router = Router();

router.get('/', ctrl.list);
router.post('/generate', ctrl.generate);
router.get('/:filename/download', ctrl.download);

export default router;
