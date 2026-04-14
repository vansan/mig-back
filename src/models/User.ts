import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  mobile: string;
  name?: string;
  licenseKey: string;
  planId: mongoose.Types.ObjectId;
  roundsRemaining: number;
  expiryDate: Date;
  usageMinutes: number;
  totalTokensUsed: number;
  totalCost: number;
  createdAt: Date;
  otp?: string;
  otpExpiry?: Date;
}

const userSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: false },
  licenseKey: { type: String, required: true, unique: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  roundsRemaining: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  usageMinutes: { type: Number, default: 0 },
  totalTokensUsed: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  otp: { type: String, required: false },
  otpExpiry: { type: Date, required: false }
});

export default mongoose.model<IUser>('User', userSchema);
