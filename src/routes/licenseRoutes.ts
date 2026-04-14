import express from 'express';
import { generateLicense, validateLicense } from '../controllers/licenseController';
import { protectAdmin } from '../middlewares/auth';

const router = express.Router();

router.post('/generate', protectAdmin, generateLicense);
router.post('/validate', validateLicense);

export default router;
