import { Router } from 'express';
import * as ctrl from '../controllers/stats.controller.js';

const router = Router();

router.get('/dashboard', ctrl.dashboard);
router.get('/workload', ctrl.workload);
router.get('/by-day', ctrl.byDay);
router.get('/by-member/:id', ctrl.byMember);
router.get('/summary', ctrl.summary);
router.get('/new-card', ctrl.newCardStats);

export default router;
