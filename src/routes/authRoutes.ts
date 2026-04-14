import express from 'express';
import { requestOtp, verifyOtp, checkoutRegister } from '../controllers/authController';

const router = express.Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register-checkout', checkoutRegister);

export default router;
