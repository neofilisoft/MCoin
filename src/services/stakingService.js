'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const txQ = require('../db/queries/transaction');
const stakingQ = require('../db/queries/staking');
const walletService = require('./walletService');
const { parseAmount } = require('../utils/currency');

/**
 * Stake MBC. Creates a staking position and locks MBC from user wallet.
 * Target can be userId, username, email, wallet_address, or discord_id.
 */
async function stake(userIdentifier, amount) {
  const amt = parseAmount(amount);
  if (!amt) throw new Error('Amount must be a positive number');

  const wallet = await walletService.getWalletByIdentifier(userIdentifier);
  if (!wallet) throw new Error(`Wallet not found for "${userIdentifier}"`);

  // Check no active position
  const existing = await stakingQ.getActiveStaking(wallet.user_id || wallet.discord_id);
  if (existing) throw new Error('You already have an active staking position. Unstake first.');

  const apr = await stakingQ.getStakingApr();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock MBC from user wallet
    await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, 'mbc', -amt);

    // Create staking position
    const positionId = await stakingQ.createStakingPosition(
      conn,
      { userId: wallet.user_id || null, discordId: wallet.discord_id || null },
      amt,
      apr
    );

    // Record transaction
    await txQ.insertTransaction(conn, {
      userId: wallet.user_id || null,
      discordId: wallet.discord_id || null,
      type: 'escrow_lock',
      currency: 'MBC',
      amount: amt,
      refId: positionId,
      note: `Staking started @ ${(apr * 100).toFixed(2)}% APR`,
    });

    await conn.commit();
    return positionId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Unstake MBC. Returns staked amount + any pending reward.
 */
async function unstake(userIdentifier) {
  const wallet = await walletService.getWalletByIdentifier(userIdentifier);
  if (!wallet) throw new Error(`Wallet not found for "${userIdentifier}"`);

  const position = await stakingQ.getActiveStaking(wallet.user_id || wallet.discord_id);
  if (!position) throw new Error('No active staking position found');

  // Calculate pending reward since last payout
  const pendingReward = _calculatePendingReward(position);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Return staked MBC to user
    await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, 'mbc', parseFloat(position.amount));

    // Pay pending reward from Master Wallet
    if (pendingReward > 0) {
      await walletQ.adjustMasterBalance(conn, 'MBC', -pendingReward);
      await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, 'mbc', pendingReward);

      await txQ.insertTransaction(conn, {
        userId: wallet.user_id || null,
        discordId: wallet.discord_id || null,
        type: 'staking_reward',
        currency: 'MBC',
        amount: pendingReward,
        refId: position.id,
        note: 'Final staking reward on unstake',
      });
    }

    // Deactivate position
    await stakingQ.deactivateStaking(conn, position.id);

    await conn.commit();
    return { returnedAmount: parseFloat(position.amount), rewardAmount: pendingReward };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Daily cron: pay staking rewards to all active stakers.
 */
async function payDailyRewards() {
  const positions = await stakingQ.getAllActiveStakings();
  let paidCount = 0;

  for (const position of positions) {
    const dailyReward = parseFloat(position.amount) * (parseFloat(position.apr) / 365);
    if (dailyReward <= 0) continue;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Pay from Master Wallet
      await walletQ.adjustMasterBalance(conn, 'MBC', -dailyReward);

      // Credit user
      await walletQ.adjustBalance(conn, position.user_id || position.discord_id, 'mbc', dailyReward);

      // Update last payout time
      await stakingQ.updateLastPayout(conn, position.id);

      // Record reward tx
      await txQ.insertTransaction(conn, {
        userId: position.user_id || null,
        discordId: position.discord_id || null,
        type: 'staking_reward',
        currency: 'MBC',
        amount: dailyReward,
        refId: position.id,
        note: 'Daily staking reward',
      });

      await conn.commit();
      paidCount++;
    } catch (err) {
      await conn.rollback();
      console.error(`[Staking] Failed to pay reward to position #${position.id}:`, err);
    } finally {
      conn.release();
    }
  }

  console.log(`[Staking] Daily rewards paid to ${paidCount}/${positions.length} stakers.`);
}

/**
 * Calculate accrued (unpaid) reward for display purposes.
 */
function _calculatePendingReward(position) {
  const now = Date.now();
  const lastPayout = new Date(position.last_payout_at).getTime();
  const daysFraction = (now - lastPayout) / (1000 * 60 * 60 * 24);
  return parseFloat(position.amount) * parseFloat(position.apr) * daysFraction / 365;
}

/**
 * Get active staking position for a user with estimated pending reward.
 */
async function getStakingInfo(userIdentifier) {
  const wallet = await walletService.getWalletByIdentifier(userIdentifier);
  if (!wallet) return null;

  const position = await stakingQ.getActiveStaking(wallet.user_id || wallet.discord_id);
  if (!position) return null;
  const pendingReward = _calculatePendingReward(position);
  return { position, pendingReward };
}

module.exports = { stake, unstake, payDailyRewards, getStakingInfo };
