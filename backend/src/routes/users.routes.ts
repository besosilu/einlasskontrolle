import { Router } from 'express';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();

router.get('/', ctrl.getUsers);
router.get('/registrations', ctrl.getRegistrationRequests);
router.post('/registrations/:id/approve', ctrl.approveRegistration);
router.post('/registrations/:id/reject', ctrl.rejectRegistration);
router.post('/:id/toggle-lock', ctrl.toggleLock);
router.delete('/:id', ctrl.deleteUser);

export default router;
