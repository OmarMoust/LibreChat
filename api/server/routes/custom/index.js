/**
 * Custom routes index
 * All custom API routes should be registered here
 * This keeps custom code isolated from core LibreChat for easier upstream merges
 */
const express = require('express');
const router = express.Router();

const transactions = require('./transactions');

// Register custom routes
router.use('/transactions', transactions);

module.exports = router;

