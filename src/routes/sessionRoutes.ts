import express from 'express';
import { startSession, startTrialSession, endSession, updateUsage } from '../controllers/sessionController';

const router = express.Router();

router.post('/start', startSession);
router.post('/start-trial', startTrialSession);
router.post('/end', endSession);
router.post('/update', updateUsage);
router.post('/', updateUsage); // alias for /api/usage

export default router;
