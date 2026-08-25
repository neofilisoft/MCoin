'use strict';
const express = require('express');
const stakingService = require('../../../services/stakingService');
const stakingQ = require('../../../db/queries/staking');
const walletService = require('../../../services/walletService');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();
router.use(requireUserAuth);

/**
 * GET /api/v1/staking/info
 * Get staking status, APR, and estimated rewards.
 */
router.get('/info', async (req, res) => {
  try {
    const [info, apr, wallet] = await Promise.all([
      stakingService.getStakingInfo(req.user.id),
      stakingQ.getStakingApr(),
      walletService.getWalletByUserId(req.user.id),
    ]);

    res.json({
      apr,
      aprPercent: `${(apr * 100).toFixed(2)}%`,
      availableMbc: wallet ? parseFloat(wallet.mbc) : 0,
      position: info ? info.position : null,
      pendingReward: info ? info.pendingReward : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/staking/stake
 * Lock MBC into staking.
 * Body: { amount }
 */
router.post('/stake', async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const positionId = await stakingService.stake(req.user.id, amount);
    const info = await stakingService.getStakingInfo(req.user.id);
    res.status(201).json({ success: true, positionId, info });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/staking/unstake
 * Withdraw staked MBC and collect rewards.
 */
router.post('/unstake', async (req, res) => {
  try {
    const result = await stakingService.unstake(req.user.id);
    const wallet = await walletService.getWalletByUserId(req.user.id);
    res.json({ success: true, ...result, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
