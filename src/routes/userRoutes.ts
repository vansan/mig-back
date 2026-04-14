import express from 'express';
import { adminLogin, getUsers, deactivateLicense, extendExpiry, addExtraRounds, createUser, deleteUser, updateUserPlan, updateUser } from '../controllers/userController';
import { protectAdmin } from '../middlewares/auth';

const router = express.Router();

router.post('/login', adminLogin);

router.get('/', protectAdmin, getUsers);
router.put('/:id/deactivate', protectAdmin, deactivateLicense);
router.put('/:id/extend', protectAdmin, extendExpiry);
router.put('/:id/add-rounds', protectAdmin, addExtraRounds);
router.put('/:id/plan', protectAdmin, updateUserPlan);
router.put('/:id', protectAdmin, updateUser);

router.post('/', protectAdmin, createUser);
router.delete('/:id', protectAdmin, deleteUser);

export default router;
