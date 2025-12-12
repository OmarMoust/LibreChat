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
    
    // Build match stage for aggregation
    const matchStage = startDate
      ? {
          $and: [
            { $or: [{ user: userId }, { user: userObjectId }] },
            { createdAt: { $gte: startDate } },
          ],
        }
      : { $or: [{ user: userId }, { user: userObjectId }] };

    // Aggregate statistics
    // Note: rawAmount is stored as NEGATIVE values
    // For prompts with caching: use inputTokens + writeTokens + readTokens
    // tokenValue is internal credits, NOT actual dollar cost
    const aggregation = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          // For prompt tokens: prefer structured tokens if available, otherwise use rawAmount
          promptTokens: {
            $sum: {
              $cond: [
                { $eq: ['$tokenType', 'prompt'] },
                {
                  $add: [
                    { $abs: { $ifNull: ['$inputTokens', 0] } },
                    { $abs: { $ifNull: ['$writeTokens', 0] } },
                    { $abs: { $ifNull: ['$readTokens', 0] } },
                  ],
                },
                0,
              ],
            },
          },
          // Fallback for prompts without structured tokens
          promptTokensRaw: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$tokenType', 'prompt'] },
                    { $eq: [{ $ifNull: ['$inputTokens', 0] }, 0] },
                    { $eq: [{ $ifNull: ['$writeTokens', 0] }, 0] },
                    { $eq: [{ $ifNull: ['$readTokens', 0] }, 0] },
                  ],
                },
                { $abs: '$rawAmount' },
                0,
              ],
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
      { $match: matchStage },
      {
        $group: {
          _id: '$model',
          // Calculate tokens properly based on type
          tokens: {
            $sum: {
              $cond: [
                { $eq: ['$tokenType', 'prompt'] },
                // For prompts: use structured tokens if available
                {
                  $cond: [
                    {
                      $gt: [
                        {
                          $add: [
                            { $abs: { $ifNull: ['$inputTokens', 0] } },
                            { $abs: { $ifNull: ['$writeTokens', 0] } },
                            { $abs: { $ifNull: ['$readTokens', 0] } },
                          ],
                        },
                        0,
                      ],
                    },
                    {
                      $add: [
                        { $abs: { $ifNull: ['$inputTokens', 0] } },
                        { $abs: { $ifNull: ['$writeTokens', 0] } },
                        { $abs: { $ifNull: ['$readTokens', 0] } },
                      ],
                    },
                    { $abs: '$rawAmount' },
                  ],
                },
                // For completions: use rawAmount
                { $abs: '$rawAmount' },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { tokens: -1 } },
      { $limit: 10 },
    ]);

    // Get daily usage for chart
    const dailyUsage = await Transaction.aggregate([
      { $match: matchStage },
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

    const rawSummary = aggregation[0] || {
      promptTokens: 0,
      promptTokensRaw: 0,
      completionTokens: 0,
      transactionCount: 0,
    };

    // Use structured prompt tokens, or fall back to raw if no structured data
    const promptTokens = rawSummary.promptTokens > 0 ? rawSummary.promptTokens : rawSummary.promptTokensRaw;
    const completionTokens = rawSummary.completionTokens;
    const totalTokens = promptTokens + completionTokens;

    // Note: We don't calculate cost here because tokenValue is internal credits, not dollars
    // Real cost would require knowing actual API pricing per model
    const summary = {
      totalTokens,
      promptTokens,
      completionTokens,
      transactionCount: rawSummary.transactionCount,
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

