import { Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import User from '../models/User';
import Plan from '../models/Plan';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findById(planId);
    
    if (!plan) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
    });

    const options = {
      amount: plan.price * 100, // amount in smallest currency unit
      currency: "INR",
      receipt: uuidv4()
    };

    const order = await instance.orders.create(options);
    if (!order) {
       res.status(500).json({ message: 'Some error occurred while creating order' });
       return;
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message });
  }
};

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      mobile,
      planId
    } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      res.status(400).json({ message: 'Transaction not legit!' });
      return;
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
       res.status(404).json({ message: 'Plan not found' });
       return;
    }

    // Check if user already exists
    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.findOne({ email });
    }

    const expiryDate = new Date();
    if (plan.validityDays) {
       expiryDate.setDate(expiryDate.getDate() + plan.validityDays);
    } else {
       // default 365 days if no expiration for some plans
       expiryDate.setDate(expiryDate.getDate() + 365);
    }

    if (user) {
       // Update existing user
       user.planId = plan._id as any;
       user.roundsRemaining += plan.rounds;
       user.expiryDate = expiryDate;
       await user.save();
    } else {
       // Create new user
       user = new User({
         email,
         mobile,
         name: email.split('@')[0],
         licenseKey: uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase(),
         planId: plan._id,
         roundsRemaining: plan.rounds,
         expiryDate,
         totalCost: plan.price
       });
       await user.save();
    }

    res.json({
      message: 'Payment verified and plan activated successfully',
      licenseKey: user.licenseKey,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
