import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  price: number;
  rounds: number;
  validityDays: number;
  perRoundPrice: number;
  costPerRound: number;
  profitPerRound: number;
  createdAt: Date;
}

const planSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  rounds: { type: Number, required: true },
  validityDays: { type: Number, required: true },
  // Auto-computed: price / rounds — stored for analytics
  perRoundPrice: { type: Number, default: 0 },
  costPerRound: { type: Number, default: 0 },
  profitPerRound: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IPlan>('Plan', planSchema);
