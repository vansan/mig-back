import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import planRoutes from './routes/planRoutes';
import licenseRoutes from './routes/licenseRoutes';
import sessionRoutes from './routes/sessionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import couponRoutes from './routes/couponRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/plans', planRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/usage', sessionRoutes); // Handle usage logic here
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.get('/', (req, res) => {
  res.send('MyInterviewGenie API is perfectly running.');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
