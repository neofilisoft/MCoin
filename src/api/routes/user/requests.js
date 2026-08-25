'use strict';
const express = require('express');
const requestService = require('../../../services/requestService');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();
router.use(requireUserAuth);

/**
 * GET /api/v1/requests
 * List incoming and outgoing payment requests.
 * Query: ?filter=all|incoming|outgoing&status=pending|paid|declined|cancelled
 */
router.get('/', async (req, res) => {
  const { filter = 'all', status } = req.query;
  try {
    const requests = await requestService.getUserRequests(req.user.id, { filter, status });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/requests
 * Create a new payment request.
 * Body: { target, currency, amount, note? }
 */
router.post('/', async (req, res) => {
  const { target, currency, amount, note } = req.body;

  if (!target) return res.status(400).json({ error: 'target is required' });
  if (!currency) return res.status(400).json({ error: 'currency is required' });
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const request = await requestService.createRequest(
      req.user.id,
      target,
      currency,
      amount,
      note || null
    );

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/requests/:id
 * Get details of a single request.
 */
router.get('/:id', async (req, res) => {
  try {
    const request = await requestService.getRequest(parseInt(req.params.id, 10));
    if (!request) return res.status(404).json({ error: 'Payment request not found' });
    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/requests/:id/pay
 * Pay / fulfill a payment request.
 */
router.post('/:id/pay', async (req, res) => {
  try {
    const result = await requestService.payRequest(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/requests/:id/decline
 * Decline a payment request.
 */
router.post('/:id/decline', async (req, res) => {
  try {
    const request = await requestService.declineRequest(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/requests/:id/cancel
 * Cancel a payment request by requester.
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const request = await requestService.cancelRequest(parseInt(req.params.id, 10), req.user.id);
    res.json({ success: true, request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
