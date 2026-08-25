'use strict';
const express = require('express');
const escrowService = require('../../../services/escrowService');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();
router.use(requireUserAuth);

/**
 * GET /api/v1/escrows
 * List escrows where user is sender or receiver.
 * Query: ?filter=all|sender|receiver&status=pending|completed|cancelled|timeout
 */
router.get('/', async (req, res) => {
  const { filter = 'all', status } = req.query;
  try {
    const escrows = await escrowService.getUserEscrows(req.user.id, { filter, status });
    res.json({ escrows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/escrows
 * Create a new escrow.
 * Body: { recipient, currency, amount, note?, durationMs? }
 */
router.post('/', async (req, res) => {
  const { recipient, currency, amount, note, durationMs } = req.body;

  if (!recipient) return res.status(400).json({ error: 'recipient is required' });
  if (!currency) return res.status(400).json({ error: 'currency is required' });
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const escrowId = await escrowService.createEscrow(
      req.user.id,
      recipient,
      currency,
      amount,
      note || null,
      durationMs ? parseInt(durationMs, 10) : undefined
    );

    const escrow = await escrowService.getEscrow(escrowId);
    res.status(201).json({ success: true, escrow });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/escrows/:id
 * Get details of a single escrow.
 */
router.get('/:id', async (req, res) => {
  try {
    const escrow = await escrowService.getEscrow(parseInt(req.params.id, 10));
    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
    res.json({ escrow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/escrows/:id/accept
 * Accept an escrow (by receiver).
 */
router.post('/:id/accept', async (req, res) => {
  try {
    const escrow = await escrowService.acceptEscrow(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, escrow });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/escrows/:id/reject
 * Reject an escrow (by receiver).
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const escrow = await escrowService.rejectEscrow(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, escrow });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/escrows/:id/cancel
 * Cancel an escrow (by sender).
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const escrow = await escrowService.cancelEscrow(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, escrow });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
