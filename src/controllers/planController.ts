import { Request, Response } from 'express';
import Plan from '../models/Plan';

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, price, rounds, validityDays, costPerRound, profitPerRound } = req.body;

    // Auto-compute perRoundPrice
    const perRoundPrice = rounds > 0 ? Math.round((price / rounds) * 100) / 100 : 0;

    const plan = new Plan({
      name,
      price,
      rounds,
      validityDays,
      perRoundPrice,
      costPerRound: costPerRound || 0,
      profitPerRound: profitPerRound || 0
    });

    const createdPlan = await plan.save();
    res.status(201).json(createdPlan);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    const updateData = { ...req.body };

    // Recompute perRoundPrice if price or rounds changed
    if (updateData.price !== undefined || updateData.rounds !== undefined) {
      const existing = await Plan.findById(id);
      if (existing) {
        const price = updateData.price ?? existing.price;
        const rounds = updateData.rounds ?? existing.rounds;
        if (rounds > 0) {
          updateData.perRoundPrice = Math.round((price / rounds) * 100) / 100;
        }
      }
    }

    const plan = await Plan.findByIdAndUpdate(id, updateData, { new: true });

    if (plan) {
      res.json(plan);
    } else {
      res.status(404).json({ message: 'Plan not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find({});
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (plan) {
      res.json({ message: 'Plan removed' });
    } else {
      res.status(404).json({ message: 'Plan not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

/**
 * Seed the default plans defined in the product spec.
 * Safe to call multiple times — skips if plans already exist.
 */
export const seedDefaultPlans = async (): Promise<void> => {
  const count = await Plan.countDocuments();
  if (count > 0) return;

  const defaults = [
    { name: '1 Round Pack',  price: 999,  rounds: 1,  validityDays: 5  },
    { name: '5 Round Pack',  price: 3995, rounds: 5,  validityDays: 10 },
    { name: '10 Round Pack', price: 4990, rounds: 10, validityDays: 15 },
    { name: '20 Round Pack', price: 9980, rounds: 20, validityDays: 30 },
  ];

  await Plan.insertMany(
    defaults.map(p => ({ ...p, perRoundPrice: Math.round((p.price / p.rounds) * 100) / 100 }))
  );
};
