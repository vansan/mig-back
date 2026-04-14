import express from 'express';
import { getDashboardStats, getCostPerRound, getProfitPerRound, getMostActiveUsers } from '../controllers/analyticsController';
import { protectAdmin } from '../middlewares/auth';

const router = express.Router();

router.use(protectAdmin); // Apply admin auth to all analytics routes

router.get('/dashboard', getDashboardStats);
router.get('/cost', getCostPerRound);
router.get('/profit', getProfitPerRound);
router.get('/active-users', getMostActiveUsers);

export default router;
