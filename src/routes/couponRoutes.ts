import express from 'express';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/couponController';
import { protectAdmin } from '../middlewares/auth';

const router = express.Router();

router.route('/')
  .get(protectAdmin, getCoupons)
  .post(protectAdmin, createCoupon);

router.route('/:id')
  .put(protectAdmin, updateCoupon)
  .delete(protectAdmin, deleteCoupon);

export default router;
