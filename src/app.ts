import express from 'express';
import cors from 'cors';
import planRoutes from './routes/planRoutes';
import licenseRoutes from './routes/licenseRoutes';
import sessionRoutes from './routes/sessionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';

/**
 * Creates an Express app instance WITHOUT starting a server or connecting a DB.
 * Used by tests — they wire up their own in-memory MongoDB before calling this.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/plans', planRoutes);
  app.use('/api/license', licenseRoutes);
  app.use('/api/session', sessionRoutes);
  app.use('/api/usage', sessionRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/payments', paymentRoutes);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  app.get('/', (_req, res) => {
    res.send('MyInterviewGenie API is perfectly running.');
  });

  return app;
}
