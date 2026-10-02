import express from 'express';
import cors from 'cors';
import path from 'path';
import membersRoutes from './routes/members.routes.js';
import entriesRoutes from './routes/entries.routes.js';
import scanRoutes from './routes/scan.routes.js';
import statsRoutes from './routes/stats.routes.js';
import importRoutes from './routes/import.routes.js';
import pricesRoutes from './routes/prices.routes.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireAdmin } from './middleware/requireAuth.js';
import { runMigrations } from './lib/migrate.js';
import { ensureAdminUser } from './services/auth.service.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/members', requireAuth, membersRoutes);
app.use('/api/v1/entries', requireAuth, entriesRoutes);
app.use('/api/v1/scan', requireAuth, scanRoutes);
app.use('/api/v1/stats', requireAuth, statsRoutes);
app.use('/api/v1/import', requireAuth, importRoutes);
app.use('/api/v1/prices', requireAuth, pricesRoutes);
app.use('/api/v1/users', requireAdmin, usersRoutes);

const frontendDist = process.env['FRONTEND_DIST_PATH'] ?? path.join(__dirname, '../public');
app.use(express.static(frontendDist));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

runMigrations()
  .then(() => ensureAdminUser())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend läuft auf Port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Start fehlgeschlagen:', err);
    process.exit(1);
  });
