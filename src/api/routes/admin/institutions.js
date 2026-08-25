'use strict';
const express = require('express');
const crypto = require('crypto');
const pool = require('../../../db/connection');
const { requireApiKey } = require('../../middleware/auth');

const router = express.Router();
const adminAuth = requireApiKey('ADMIN_API_KEY');

/**
 * POST /admin/institutions
 * Register a new third-party institution (bank/app).
 * Returns the raw API key once - store it securely.
 * Body: { name, slug, webhookUrl? }
 */
router.post('/', adminAuth, async (req, res) => {
  const { name, slug, webhookUrl } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase alphanumeric with hyphens only' });
  }

  // Generate a raw API key (shown once)
  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO institutions (name, slug, api_key_hash, webhook_url)
       VALUES (?, ?, ?, ?)`,
      [name, slug, keyHash, webhookUrl || null]
    );
    const instId = result.insertId;

    // Create institution wallet
    await conn.query(
      'INSERT INTO institution_wallets (institution_id) VALUES (?)',
      [instId]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      institution: { id: instId, name, slug },
      api_key: rawKey,
      warning: 'Save this API key now. It will NOT be shown again.',
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Slug "${slug}" is already taken` });
    }
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /admin/institutions
 * List all institutions.
 */
router.get('/', adminAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, slug, webhook_url, is_active, created_at FROM institutions ORDER BY id'
  );
  res.json({ institutions: rows });
});

/**
 * GET /admin/institutions/:id/wallet
 * View an institution's reserve wallet.
 */
router.get('/:id/wallet', adminAuth, async (req, res) => {
  const [[wallet]] = await pool.query(
    'SELECT * FROM institution_wallets WHERE institution_id = ?',
    [req.params.id]
  );
  if (!wallet) return res.status(404).json({ error: 'Institution not found' });
  res.json({ wallet });
});

/**
 * PATCH /admin/institutions/:id
 * Update institution (activate/deactivate, change webhook).
 * Body: { isActive?, webhookUrl? }
 */
router.patch('/:id', adminAuth, async (req, res) => {
  const { isActive, webhookUrl } = req.body;
  const sets = [];
  const params = [];

  if (typeof isActive === 'boolean') { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (webhookUrl !== undefined) { sets.push('webhook_url = ?'); params.push(webhookUrl); }

  if (sets.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

  params.push(req.params.id);
  await pool.query(`UPDATE institutions SET ${sets.join(', ')} WHERE id = ?`, params);
  res.json({ success: true });
});

module.exports = router;
