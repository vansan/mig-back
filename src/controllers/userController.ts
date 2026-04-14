import { Request, Response } from 'express';
import User from '../models/User';
import Plan from '../models/Plan';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    // Hardcoded logic for simplicity based on env
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '1d' });
      res.json({ token, username });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
     res.status(500).json({ message: (error as Error).message });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).populate('planId');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const deactivateLicense = async (req: Request, res: Response): Promise<void> => {
   try {
     const { id } = req.params;
     const user = await User.findById(id);
     if (user) {
        user.roundsRemaining = 0;
        user.expiryDate = new Date();
        await user.save();
        res.json({ message: 'License deactivated', user });
     } else {
        res.status(404).json({ message: 'User not found' });
     }
   } catch (error) {
     res.status(500).json({ message: (error as Error).message });
   }
};

export const extendExpiry = async (req: Request, res: Response): Promise<void> => {
   try {
     const { id } = req.params;
     const { days } = req.body;
     const user = await User.findById(id);
     if (user) {
        const currentExpiry = new Date(user.expiryDate);
        currentExpiry.setDate(currentExpiry.getDate() + Number(days));
        user.expiryDate = currentExpiry;
        await user.save();
        res.json({ message: 'Expiry extended', user });
     } else {
        res.status(404).json({ message: 'User not found' });
     }
   } catch (error) {
     res.status(500).json({ message: (error as Error).message });
   }
};

export const addExtraRounds = async (req: Request, res: Response): Promise<void> => {
   try {
     const { id } = req.params;
     const { rounds } = req.body;
     const user = await User.findById(id);
     if (user) {
        user.roundsRemaining += Number(rounds);
        await user.save();
        res.json({ message: 'Rounds added', user });
     } else {
        res.status(404).json({ message: 'User not found' });
     }
   } catch (error) {
     res.status(500).json({ message: (error as Error).message });
   }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, planId } = req.body;
    
    const plan = await Plan.findById(planId);
    if (!plan) {
       res.status(400).json({ message: 'Invalid plan ID' });
       return;
    }

    let user = await User.findOne({ $or: [{ email }, { mobile }] });
    
    if (user) {
       // Update existing user (Approve scenario)
       user.planId = plan._id;
       user.roundsRemaining += plan.rounds;
       user.expiryDate = new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000);
       await user.save();
       res.json({ message: 'User approved/updated successfully', user });
       return;
    }

    const licenseKey = uuidv4();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.validityDays);

    user = new User({
      name,
      email,
      mobile,
      licenseKey,
      planId: plan._id,
      roundsRemaining: plan.rounds,
      expiryDate,
    });

    await user.save();
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
       res.status(404).json({ message: 'User not found' });
       return;
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
     res.status(500).json({ message: (error as Error).message });
  }
};

export const updateUserPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { planId } = req.body;
    
    const plan = await Plan.findById(planId);
    if (!plan) {
       res.status(400).json({ message: 'Invalid plan ID' });
       return;
    }

    const user = await User.findById(id);
    if (!user) {
       res.status(404).json({ message: 'User not found' });
       return;
    }

    user.planId = plan._id;
    user.roundsRemaining += plan.rounds;
    user.expiryDate = new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000);
    
    await user.save();
    // Re-populate plan info before returning
    await user.populate('planId');
    
    res.json({ message: 'User plan approved successfully', user });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, mobile } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
       res.status(404).json({ message: 'User not found' });
       return;
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (mobile) user.mobile = mobile;

    await user.save();
    await user.populate('planId');

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
