'use strict';
const express = require('express');
const splitService = require('../../../services/splitService');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();
router.use(requireUserAuth);

/**
 * GET /api/v1/splits
 * List all split bills involving the user.
 */
router.get('/', async (req, res) => {
  try {
    const splits = await splitService.getUserSplits(req.user.id);
    res.json({ splits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/splits
 * Create a new split bill.
 * Body: { members: string[], currency: string, totalAmount: number, description?: string, shares?: number[] }
 */
router.post('/', async (req, res) => {
  const { members, currency, totalAmount, description, shares } = req.body;

  if (!members || !Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'members array is required' });
  }
  if (!currency) return res.status(400).json({ error: 'currency is required' });
  if (!totalAmount) return res.status(400).json({ error: 'totalAmount is required' });

  try {
    const split = await splitService.createSplitBill(
      req.user.id,
      members,
      currency,
      totalAmount,
      description || null,
      shares || null
    );

    res.status(201).json({ success: true, split });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/splits/:id
 * Get details of a single split bill.
 */
router.get('/:id', async (req, res) => {
  try {
    const split = await splitService.getSplitBill(parseInt(req.params.id, 10));
    if (!split) return res.status(404).json({ error: 'Split bill not found' });
    res.json({ split });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
