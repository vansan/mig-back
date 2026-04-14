import { Request, Response } from 'express';
import User from '../models/User';
import Session from '../models/Session';

const TRIAL_DURATION_MINUTES = 9;

// ─── START PAID SESSION ──────────────────────────────────────────────────────
export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseKey } = req.body;

    const user = await User.findOne({ licenseKey });
    if (!user) {
      res.status(404).json({ message: 'Invalid license key' });
      return;
    }

    if (user.roundsRemaining <= 0) {
      res.status(400).json({ message: 'No rounds remaining' });
      return;
    }

    const now = new Date();
    if (now > user.expiryDate) {
      res.status(400).json({ message: 'License expired' });
      return;
    }

    // Don't deduct round yet — deducted at end if session > 9 min
    const session = new Session({
      userId: user._id,
      planId: user.planId,
      sessionType: 'paid',
      startTime: new Date(),
    });

    const savedSession = await session.save();
    res.status(201).json({ sessionId: savedSession._id, roundsRemaining: user.roundsRemaining });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// ─── START TRIAL SESSION ─────────────────────────────────────────────────────
// Trial requires only a licenseKey (or userId) for tracking purposes.
// Works even if user has no active plan / expired plan / 0 rounds.
export const startTrialSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      res.status(400).json({ message: 'licenseKey is required' });
      return;
    }

    const user = await User.findOne({ licenseKey });
    if (!user) {
      res.status(404).json({ message: 'Invalid license key' });
      return;
    }

    // Trial is always allowed — no round/expiry checks
    const session = new Session({
      userId: user._id,
      planId: undefined,       // no plan tied to a trial
      sessionType: 'trial',
      startTime: new Date(),
    });

    const savedSession = await session.save();
    res.status(201).json({
      sessionId: savedSession._id,
      sessionType: 'trial',
      trialDurationMinutes: TRIAL_DURATION_MINUTES,
      message: `Trial session started. Maximum duration: ${TRIAL_DURATION_MINUTES} minutes.`
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// ─── END SESSION ─────────────────────────────────────────────────────────────
export const endSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    session.endTime = new Date();
    const diffMs = session.endTime.getTime() - session.startTime.getTime();
    session.durationMinutes = Math.floor(diffMs / 60000);

    if (session.sessionType === 'trial') {
      // Trial: cap duration, never deduct rounds
      session.durationMinutes = Math.min(session.durationMinutes, TRIAL_DURATION_MINUTES);
      session.countedAsRound = false;
    } else {
      // Paid: deduct 1 round if session exceeded 9 minutes
      if (session.durationMinutes > TRIAL_DURATION_MINUTES && !session.countedAsRound) {
        const user = await User.findById(session.userId);
        if (user) {
          user.roundsRemaining -= 1;
          await user.save();
        }
        session.countedAsRound = true;
      }
    }

    await session.save();
    res.json({ message: 'Session ended', session });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// ─── UPDATE USAGE (HEARTBEAT) ─────────────────────────────────────────────────
export const updateUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, tokensUsed, aiCost, usageMinutes } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    session.tokensUsed += (tokensUsed || 0);
    session.aiCost += (aiCost || 0);
    session.durationMinutes += (usageMinutes || 0);

    await session.save();

    const user = await User.findById(session.userId);
    if (user) {
      user.totalTokensUsed += (tokensUsed || 0);
      user.totalCost += (aiCost || 0);
      user.usageMinutes += (usageMinutes || 0);

      if (session.sessionType === 'paid') {
        // Compute real elapsed time to decide round deduction
        const actualElapsedMs = new Date().getTime() - session.startTime.getTime();
        const actualElapsedMinutes = Math.floor(actualElapsedMs / 60000);

        if (actualElapsedMinutes > TRIAL_DURATION_MINUTES && !session.countedAsRound) {
          user.roundsRemaining -= 1;
          session.countedAsRound = true;
        }
      }
      // For trial sessions: never deduct round during heartbeat

      await user.save();
    }
    await session.save();

    res.json({ message: 'Usage updated', session });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
