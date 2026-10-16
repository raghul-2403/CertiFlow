import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, PROJECT_ROOT } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/events.routes.js';
import designRoutes, { designCatalog } from './routes/design.routes.js';
import certificateRoutes from './routes/certificates.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import publicRoutes from './routes/public.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
// Behind a hosting proxy (Render, Railway…) this gives the visitor's real IP to the rate limiter
app.set('trust proxy', 1);
const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        // blob: lets the dashboard show the uploaded design and open certificate PDFs
        'img-src': ["'self'", 'data:', 'blob:'],
        'frame-src': ["'self'", 'blob:'],
      },
    },
  })
);
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (!env.isProd) app.use(morgan('dev', { skip: (req) => !req.originalUrl.startsWith('/api') }));

// ---- API ----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events/:id/design', designRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/designs', designCatalog);
app.use('/api/certificates', certificateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', notFound);

// ---- React dashboard (built files) ----
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
