import { Router } from 'express';
import * as ctrl from '../controllers/members.controller.js';

const router = Router();

router.get('/', ctrl.search);
router.get('/list', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/flags', ctrl.updateFlags);

export default router;
