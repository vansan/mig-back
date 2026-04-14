import { Request, Response } from 'express';
import User from '../models/User';
import Session from '../models/Session';
import Plan from '../models/Plan';
import mongoose from 'mongoose';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const activeLicenses = await User.countDocuments({ expiryDate: { $gt: new Date() }, roundsRemaining: { $gt: 0 } });
    
    const revenueAgg = await User.aggregate([
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan'
        }
      },
      { $unwind: '$plan' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$plan.price' }
        }
      }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    const costAgg = await Session.aggregate([
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$aiCost' },
          totalTokens: { $sum: '$tokensUsed' }
        }
      }
    ]);
    const totalAICost = costAgg[0]?.totalCost || 0;
    const totalTokens = costAgg[0]?.totalTokens || 0;

    const totalProfit = totalRevenue - totalAICost;

    res.json({
      totalUsers,
      activeLicenses,
      totalRevenue,
      totalAICost,
      totalProfit,
      totalTokens
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getCostPerRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await Session.aggregate([
      {
        $group: {
          _id: null,
          avgCost: { $avg: '$aiCost' },
          totalCost: { $sum: '$aiCost' },
          count: { $sum: 1 }
        }
      }
    ]);
    res.json(sessions[0] || { avgCost: 0, totalCost: 0, count: 0 });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getProfitPerRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const revenueAgg = await User.aggregate([
      {
        $lookup: {
          from: 'plans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan'
        }
      },
      { $unwind: '$plan' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$plan.price' },
          totalRounds: { $sum: '$plan.rounds' } // potential
        }
      }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalRounds = revenueAgg[0]?.totalRounds || 0;

    const sessionCount = await Session.countDocuments();
    
    // Average revenue per theoretical round
    const avgRevenuePerRound = sessionCount ? totalRevenue / sessionCount : 0;
    
    const costAgg = await Session.aggregate([
      {
        $group: {
          _id: null,
          avgCost: { $avg: '$aiCost' }
        }
      }
    ]);
    const avgCostPerRound = costAgg[0]?.avgCost || 0;
    const profitPerRound = avgRevenuePerRound - avgCostPerRound;

    res.json({ profitPerRound, avgRevenuePerRound, avgCostPerRound });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getMostActiveUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const active = await User.find().sort({ usageMinutes: -1 }).limit(10).populate('planId');
    res.json(active);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
