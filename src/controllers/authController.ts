import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Plan from '../models/Plan';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, email } = req.body;
    
    if (!mobile || !email) {
      res.status(400).json({ message: 'Mobile number and email are required' });
      return;
    }

    let user = await User.findOne({ mobile });
    
    // Auto-register if user doesn't exist
    if (!user) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
         res.status(400).json({ message: 'Email is already registered with a different mobile number.' });
         return;
      }
      const defaultPlan = await Plan.findOne();
      user = new User({
         email,
         mobile,
         licenseKey: uuidv4(),
         planId: defaultPlan?._id || new mongoose.Types.ObjectId(), // fallback
         roundsRemaining: 0,
         expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // 10 minutes expiry

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send email with OTP
    const emailUser = process.env.VITE_EMAIL_USER || process.env.EMAIL_USER;
    const emailPass = process.env.VITE_EMAIL_PASS || process.env.EMAIL_PASS;
    
    if (emailUser && emailPass && user.email) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: emailUser, pass: emailPass }
        });
        
        await transporter.sendMail({
          from: emailUser,
          to: user.email,
          subject: "Your OTP for MyInterviewGenie",
          text: `Your login OTP is: ${otp}. It will expire in 10 minutes.`
        });
        console.log(`[AUTH] Sent OTP email to ${user.email}`);
      } catch (err) {
        console.error(`[AUTH] Failed to send OTP email to ${user.email}`, err);
      }
    }

    // Here you would integrate with SMS Gateway (e.g., Twilio, MSG91)
    // For now we log it in development
    console.log(`[DEV ONLY] OTP for ${mobile} and email ${user.email} is ${otp}`);

    res.json({ message: 'OTP sent successfully to your mobile number and email' });
  } catch (error) {
     res.status(500).json({ message: (error as Error).message });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
       res.status(400).json({ message: 'Mobile and OTP are required' });
       return;
    }

    const user = await User.findOne({ mobile });
    if (!user) {
       res.status(404).json({ message: 'User not found' });
       return;
    }

    if (!user.otp || !user.otpExpiry || user.otp !== otp || user.otpExpiry < new Date()) {
       res.status(400).json({ message: 'Invalid or expired OTP' });
       return;
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Issue JWT Token
    const token = jwt.sign(
      { userId: user._id, licenseKey: user.licenseKey, mobile: user.mobile },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
     res.status(500).json({ message: (error as Error).message });
  }
};

export const checkoutRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, mobile, email } = req.body;
    let user = await User.findOne({ $or: [{ email }, { mobile }] });
    if (!user) {
      const defaultPlan = await Plan.findOne();
      user = new User({
         name,
         email,
         mobile,
         licenseKey: uuidv4(),
         planId: defaultPlan?._id || new mongoose.Types.ObjectId(), // fallback
         roundsRemaining: 0,
         expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      await user.save();
    }
    res.json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
