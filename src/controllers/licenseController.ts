import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User';
import Plan from '../models/Plan';

export const generateLicense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, mobile, name, planId } = req.body;

    if (!email || !mobile) {
      res.status(400).json({ message: 'email and mobile are required' });
      return;
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }

    const licenseKey = uuidv4();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.validityDays);

    const user = new User({
      email,
      mobile,
      name: name || email.split('@')[0],
      licenseKey,
      planId: plan._id,
      roundsRemaining: plan.rounds,
      expiryDate,
      usageMinutes: 0,
      totalTokensUsed: 0,
      totalCost: 0
    });

    const createdUser = await user.save();
    
    res.status(201).json({
      licenseKey: createdUser.licenseKey,
      planName: plan.name,
      roundsRemaining: createdUser.roundsRemaining,
      expiryDate: createdUser.expiryDate,
      user: createdUser
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const validateLicense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseKey } = req.body;

    const user = await User.findOne({ licenseKey }).populate('planId');
    
    if (!user) {
      res.status(404).json({ valid: false, message: 'Invalid license key' });
      return;
    }

    const now = new Date();
    if (now > user.expiryDate) {
      res.json({ valid: false, message: 'License expired' });
      return;
    }

    if (user.roundsRemaining <= 0) {
      res.json({ valid: false, message: 'No rounds remaining' });
      return;
    }

    // @ts-ignore
    const plan = user.planId as any;

    res.json({
      valid: true,
      roundsRemaining: user.roundsRemaining,
      expiryDate: user.expiryDate,
      planName: plan?.name || 'Unknown Plan',
      trialAvailable: true  // trial is always available regardless of plan status
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: (error as Error).message });
  }
};
