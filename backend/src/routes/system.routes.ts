import { Router } from 'express';
import { APP_TIMEZONE } from '../lib/timezone.js';

const router = Router();

// Clock of the container, so the UI can show it and warn when it differs from the browser
// (Docker Desktop stops its clock during standby)
router.get('/time', (_req, res) => {
  res.json({ now: new Date().toISOString(), timezone: APP_TIMEZONE });
});

export default router;
