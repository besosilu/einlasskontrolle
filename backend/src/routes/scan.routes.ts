import { Router } from 'express';
import { scan } from '../controllers/scan.controller.js';

const router = Router();

router.post('/', scan);

export default router;
