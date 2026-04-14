import express from 'express';
import { createPlan, getPlans, updatePlan, deletePlan } from '../controllers/planController';
import { protectAdmin } from '../middlewares/auth';

const router = express.Router();

router.route('/')
  .post(protectAdmin, createPlan)
  .get(getPlans);

router.post('/update', protectAdmin, updatePlan);
router.delete('/:id', protectAdmin, deletePlan);

export default router;
