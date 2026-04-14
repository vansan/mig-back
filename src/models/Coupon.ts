import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountPerRound: number;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
}

const couponSchema: Schema = new Schema({
  code: { type: String, required: true, unique: true, index: true },
  discountPerRound: { type: Number, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ICoupon>('Coupon', couponSchema);
