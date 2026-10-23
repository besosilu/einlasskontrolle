import { Router } from 'express';
import * as ctrl from '../controllers/settings.controller.js';

const router = Router();

router.get('/auto-import', ctrl.getAutoImport);
router.put('/auto-import', ctrl.setAutoImport);

export default router;
