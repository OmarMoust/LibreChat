/**
 * Custom API route for fetching user transactions
 * This is a custom addition isolated from core LibreChat code for easier upstream merges
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireJwtAuth } = require('../../middleware/');
const { Transaction } = require('~/db/models');
const { logger } = require('@librechat/data-schemas');

/**
 * Helper to convert user ID to ObjectId if needed
 */
function toObjectId(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

/**
 * GET /api/user/transactions
 * Fetches transactions for the authenticated user with optional filtering
 * Query params:
 *   - limit: number of transactions to return (default: 100, max: 1000)
 *   - offset: pagination offset (default: 0)
 *   - startDate: ISO date string for filtering transactions after this date
 *   - endDate: ISO date string for filtering transactions before this date
 *   - model: filter by model name
 *   - conversationId: filter by conversation
 */
router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      model,
      conversationId,
    } = req.query;

    // Build filter - try both string and ObjectId for user field
    const userObjectId = toObjectId(userId);
    const filter = { $or: [{ user: userId }, { user: userObjectId }] };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    if (model) {
      filter.model = model;
    }

    if (conversationId) {
      filter.conversationId = conversationId;
    }

    // Fetch transactions with pagination
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset, 10))
      .limit(Math.min(parseInt(limit, 10), 1000))
      .lean();

    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);

    res.status(200).json({
      transactions,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    logger.error('[transactions] Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /api/user/transactions/summary
 * Returns aggregated usage statistics for the authenticated user
 * Query params:
 *   - period: 'day' | 'week' | 'month' | 'all' (default: 'month')
 */
router.get('/summary', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = null;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build filter - try both string and ObjectId for user field
    const userObjectId = toObjectId(userId);
    const userFilter = { $or: [{ user: userId }, { user: userObjectId }] };
    const filter = startDate 
      ? { ...userFilter, createdAt: { $gte: startDate } }
      : userFilter;

    // Aggregate statistics
    const aggregation = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          totalCost: { $sum: { $abs: '$tokenValue' } },
          promptTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: '$rawAmount' }, 0],
            },
          },
          completionTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: '$rawAmount' }, 0],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // Get per-model breakdown
    const modelBreakdown = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$model',
          tokens: { $sum: { $abs: '$rawAmount' } },
          cost: { $sum: { $abs: '$tokenValue' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { tokens: -1 } },
      { $limit: 10 },
    ]);

    // Get daily usage for chart
    const dailyUsage = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          tokens: { $sum: { $abs: '$rawAmount' } },
          cost: { $sum: { $abs: '$tokenValue' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = aggregation[0] || {
      totalTokens: 0,
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
      transactionCount: 0,
    };

    res.status(200).json({
      ...summary,
      period,
      modelBreakdown,
      dailyUsage,
    });
  } catch (error) {
    logger.error('[transactions] Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

module.exports = router;

