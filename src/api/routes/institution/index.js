'use strict';
const express = require('express');
const pool = require('../../../db/connection');
const walletQ = require('../../../db/queries/wallet');
const txQ = require('../../../db/queries/transaction');
const walletService = require('../../../services/walletService');
const { requireInstitutionKey } = require('../../middleware/institutionAuth');
const { isValidCurrency, parseAmount } = require('../../../utils/currency');

const router = express.Router();
router.use(requireInstitutionKey);

/**
 * POST /institution/accounts
 * Open an account for a Discord user at this institution.
 * Body: { discordId }
 */
router.post('/accounts', async (req, res) => {
  const { discordId } = req.body;
  if (!discordId) return res.status(400).json({ error: 'discordId is required' });

  const inst = req.institution;

  // Ensure user has a main MCoin wallet
  await walletService.getOrCreateWallet(discordId);

  // Generate account number: INST-{instId}-{6 random digits}
  const accountNumber = `${inst.slug.toUpperCase().slice(0, 6)}-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const [result] = await pool.query(
      `INSERT INTO institution_accounts (institution_id, discord_id, account_number)
       VALUES (?, ?, ?)`,
      [inst.id, discordId, accountNumber]
    );
    res.status(201).json({
      success: true,
      account: { id: result.insertId, institution: inst.name, discordId, accountNumber },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Already has account - return existing
      const [[existing]] = await pool.query(
        'SELECT * FROM institution_accounts WHERE institution_id = ? AND discord_id = ?',
        [inst.id, discordId]
      );
      return res.json({ account: existing });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /institution/accounts/:discordId
 * Get a user's account and wallet balance.
 */
router.get('/accounts/:discordId', async (req, res) => {
  const inst = req.institution;
  const [[account]] = await pool.query(
    'SELECT * FROM institution_accounts WHERE institution_id = ? AND discord_id = ?',
    [inst.id, req.params.discordId]
  );
  if (!account) return res.status(404).json({ error: 'Account not found at this institution' });

  const wallet = await walletService.getWallet(req.params.discordId);
  res.json({ account, wallet });
});

/**
 * POST /institution/deposit
 * Transfer currency from user wallet INTO institution wallet.
 * (User deposits funds with the institution - like a bank deposit)
 * Body: { discordId, currency, amount, note? }
 */
router.post('/deposit', async (req, res) => {
  const inst = req.institution;
  const { discordId, currency, amount, note } = req.body;

  if (!discordId || !currency || !amount) {
    return res.status(400).json({ error: 'discordId, currency, and amount are required' });
  }
  if (!isValidCurrency(currency)) return res.status(400).json({ error: 'Invalid currency' });
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) return res.status(400).json({ error: 'Invalid amount' });

  // Verify user has account
  const [[account]] = await pool.query(
    'SELECT id FROM institution_accounts WHERE institution_id = ? AND discord_id = ?',
    [inst.id, discordId]
  );
  if (!account) return res.status(404).json({ error: 'User does not have an account at this institution' });

  const cur = currency.toUpperCase();
  const col = cur.toLowerCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from user wallet
    await walletQ.adjustBalance(conn, discordId, cur, -parsedAmount);

    // Credit institution wallet
    await conn.query(
      `UPDATE institution_wallets SET ${col} = ${col} + ? WHERE institution_id = ?`,
      [parsedAmount.toFixed(8), inst.id]
    );

    // Record outgoing tx for user
    const txid = await txQ.insertTransaction(conn, {
      discordId,
      type: 'external_out',
      currency: cur,
      amount: parsedAmount,
      refId: inst.id,
      note: note || `Deposit to ${inst.name}`,
    });

    await conn.commit();
    res.json({ success: true, txid, deposited: parsedAmount, currency: cur, institution: inst.name });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /institution/withdraw
 * Transfer currency FROM institution wallet back to user wallet.
 * (User withdraws - institution pays out)
 * Body: { discordId, currency, amount, note? }
 */
router.post('/withdraw', async (req, res) => {
  const inst = req.institution;
  const { discordId, currency, amount, note } = req.body;

  if (!discordId || !currency || !amount) {
    return res.status(400).json({ error: 'discordId, currency, and amount are required' });
  }
  if (!isValidCurrency(currency)) return res.status(400).json({ error: 'Invalid currency' });
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) return res.status(400).json({ error: 'Invalid amount' });

  const cur = currency.toUpperCase();
  const col = cur.toLowerCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check institution has enough reserve
    const [[instWallet]] = await conn.query(
      `SELECT ${col} FROM institution_wallets WHERE institution_id = ? FOR UPDATE`,
      [inst.id]
    );
    if (!instWallet || parseFloat(instWallet[col]) < parsedAmount) {
      throw new Error(`Institution has insufficient ${cur} reserve`);
    }

    // Deduct from institution wallet
    await conn.query(
      `UPDATE institution_wallets SET ${col} = ${col} - ? WHERE institution_id = ?`,
      [parsedAmount.toFixed(8), inst.id]
    );

    // Credit user wallet
    await walletQ.adjustBalance(conn, discordId, cur, parsedAmount);

    // Record incoming tx for user
    const txid = await txQ.insertTransaction(conn, {
      discordId,
      type: 'external_in',
      currency: cur,
      amount: parsedAmount,
      refId: inst.id,
      note: note || `Withdrawal from ${inst.name}`,
    });

    await conn.commit();
    res.json({ success: true, txid, withdrawn: parsedAmount, currency: cur, institution: inst.name });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /institution/inventory
 * Issue a digital inventory item to a user.
 * Body: { discordId, itemType, itemId, metadata?, isTransferable? }
 */
router.post('/inventory', async (req, res) => {
  const inst = req.institution;
  const { discordId, itemType, itemId, metadata, isTransferable = true } = req.body;

  if (!discordId || !itemType || !itemId) {
    return res.status(400).json({ error: 'discordId, itemType, and itemId are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO digital_inventory
       (institution_id, owner_discord_id, item_type, item_id, metadata, is_transferable)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [inst.id, discordId, itemType, itemId, metadata ? JSON.stringify(metadata) : null, isTransferable ? 1 : 0]
    );
    res.status(201).json({
      success: true,
      item: { id: result.insertId, institution: inst.name, discordId, itemType, itemId, metadata },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Item "${itemId}" already exists in this institution` });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /institution/inventory/:discordId
 * Get all inventory items owned by a user at this institution.
 */
router.get('/inventory/:discordId', async (req, res) => {
  const inst = req.institution;
  const [items] = await pool.query(
    'SELECT * FROM digital_inventory WHERE institution_id = ? AND owner_discord_id = ? ORDER BY acquired_at DESC',
    [inst.id, req.params.discordId]
  );
  res.json({ items });
});

/**
 * POST /institution/inventory/:itemId/transfer
 * Transfer a digital inventory item to another user.
 * Body: { toDiscordId }
 */
router.post('/inventory/:itemId/transfer', async (req, res) => {
  const inst = req.institution;
  const { toDiscordId } = req.body;
  if (!toDiscordId) return res.status(400).json({ error: 'toDiscordId is required' });

  const [[item]] = await pool.query(
    'SELECT * FROM digital_inventory WHERE institution_id = ? AND item_id = ?',
    [inst.id, req.params.itemId]
  );

  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (!item.is_transferable) return res.status(403).json({ error: 'This item is non-transferable' });

  await pool.query(
    'UPDATE digital_inventory SET owner_discord_id = ?, transferred_at = NOW() WHERE id = ?',
    [toDiscordId, item.id]
  );

  res.json({ success: true, itemId: req.params.itemId, newOwner: toDiscordId });
});

module.exports = router;
