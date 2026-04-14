import mongoose, { Document, Schema } from 'mongoose';

export type SessionType = 'trial' | 'paid';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  sessionType: SessionType;
  startTime: Date;
  endTime?: Date;
  durationMinutes: number;
  tokensUsed: number;
  aiCost: number;
  countedAsRound: boolean;
}

const sessionSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: false },
  sessionType: { type: String, enum: ['trial', 'paid'], default: 'paid' },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationMinutes: { type: Number, default: 0 },
  tokensUsed: { type: Number, default: 0 },
  aiCost: { type: Number, default: 0 },
  countedAsRound: { type: Boolean, default: false }
});

export default mongoose.model<ISession>('Session', sessionSchema);
