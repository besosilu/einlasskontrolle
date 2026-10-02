import { Router } from 'express';
import * as ctrl from '../controllers/entries.controller.js';

const router = Router();

router.get('/today/count', ctrl.getTodayCount);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id/notes', ctrl.updateNotes);
router.delete('/:id', ctrl.remove);

export default router;
