import { Request, Response } from 'express';
import Coupon from '../models/Coupon';

export const getCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await Coupon.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, discountPerRound, validUntil, isActive } = req.body;
    const existing = await Coupon.findOne({ code });
    if (existing) {
       res.status(400).json({ message: 'Coupon code already exists' });
       return;
    }
    const coupon = new Coupon({ code, discountPerRound, validUntil, isActive });
    await coupon.save();
    res.status(201).json({ message: 'Coupon created', coupon });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, discountPerRound, validUntil, isActive } = req.body;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
       res.status(404).json({ message: 'Coupon not found' });
       return;
    }
    if (code) coupon.code = code;
    if (discountPerRound !== undefined) coupon.discountPerRound = discountPerRound;
    if (validUntil) coupon.validUntil = validUntil;
    if (isActive !== undefined) coupon.isActive = isActive;
    
    await coupon.save();
    res.json({ message: 'Coupon updated', coupon });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
