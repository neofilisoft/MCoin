'use strict';
const cron = require('node-cron');
const { payDailyRewards } = require('./stakingService');
const { processExpiredEscrows } = require('./escrowService');

/**
 * Initialize all scheduled jobs.
 * Call once from bot/index.js and api/index.js.
 */
function initScheduler() {
  // Daily staking payout at 00:00 UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Running daily staking payout...');
    try {
      await payDailyRewards();
    } catch (err) {
      console.error('[Scheduler] Daily staking payout failed:', err);
    }
  }, { timezone: 'UTC' });

  // Check expired escrows every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await processExpiredEscrows();
    } catch (err) {
      console.error('[Scheduler] Escrow timeout check failed:', err);
    }
  });

  console.log('[Scheduler] Jobs initialized: daily staking payout, escrow timeout check (30s).');
}

module.exports = { initScheduler };
