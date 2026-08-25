'use strict';
const { EmbedBuilder } = require('discord.js');
const {
  formatAmount,
  currencyEmoji,
  TX_TYPE_LABELS,
  FIAT_CURRENCIES,
  METAL_CURRENCIES,
} = require('./currency');

const BRAND_COLOR = 0x7c3aed; // Purple - MCoin brand
const SUCCESS_COLOR = 0x10b981;
const ERROR_COLOR = 0xef4444;
const WARNING_COLOR = 0xf59e0b;
const INFO_COLOR = 0x3b82f6;

/**
 * Build a wallet balance embed.
 */
function walletEmbed(wallet, username) {
  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];

  const fields = currencies.map((cur) => ({
    name: `${currencyEmoji(cur)} ${cur}`,
    value: `\`${formatAmount(wallet[cur.toLowerCase()] || 0, cur)}\``,
    inline: true,
  }));

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('💼 MCoin Wallet')
    .setDescription(`**${username}**'s wallet`)
    .addFields(fields)
    .addFields({
      name: '🔑 Wallet Address',
      value: `\`${wallet.wallet_address}\``,
      inline: false,
    })
    .setFooter({ text: 'MCoin Bank • Centralized Wallet' })
    .setTimestamp();
}

/**
 * Build a transaction history embed (paginated).
 */
function historyEmbed(rows, meta, username) {
  const { page, totalPages, total, currency } = meta;

  const lines = rows.map((tx) => {
    const label = TX_TYPE_LABELS[tx.type] || tx.type;
    const sign = ['deposit', 'transfer_in', 'staking_reward', 'escrow_release', 'split_in', 'external_in'].includes(tx.type)
      ? '+'
      : '-';
    const amount = formatAmount(tx.amount, tx.currency);
    const date = new Date(tx.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const counterpart = tx.counterpart_id ? ` | <@${tx.counterpart_id}>` : '';
    const note = tx.note ? ` - ${tx.note}` : '';

    return `\`${date}\` ${label} **${sign}${amount}**${counterpart}${note}`;
  });

  const desc = lines.length ? lines.join('\n') : '*No transactions found.*';
  const filterInfo = currency ? ` • Filter: ${currency}` : '';

  return new EmbedBuilder()
    .setColor(INFO_COLOR)
    .setTitle('📜 Transaction History')
    .setDescription(`**${username}**\nPage ${page}/${totalPages} • ${total} total${filterInfo}\n\n${desc}`)
    .setFooter({ text: 'MCoin Bank' })
    .setTimestamp();
}

/**
 * Build a rates embed showing all exchange rates.
 * - Fiat: "1 USD = X THB"
 * - Metals: "1 XAU = X USD" (inverted for human readability - troy oz price)
 * - MBC: "1 MBC = X USD"
 */
function ratesEmbed(rates) {
  const fiatCurs = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY'];
  const metalCurs = ['XAU', 'XAG'];

  const fiatFields = fiatCurs.map((cur) => ({
    name: `${currencyEmoji(cur)} ${cur}`,
    value: cur === 'USD'
      ? '`Base currency`'
      : `1 USD = \`${parseFloat(rates[cur] || 0).toFixed(4)}\` ${cur}`,
    inline: true,
  }));

  // Metals invert the rate: rates[XAU] = 0.000303 -> 1 XAU = 3300 USD
  const metalFields = metalCurs.map((cur) => {
    const usdPerUnit = rates[cur] ? (1 / parseFloat(rates[cur])).toFixed(2) : '?';
    return {
      name: `${currencyEmoji(cur)} ${cur}`,
      value: `1 ${cur} = \`${usdPerUnit}\` USD`,
      inline: true,
    };
  });

  const mbcUsd = parseFloat(rates.MBC || 0).toFixed(4);

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📊 Exchange Rates')
    .setDescription('Fiat + Metals: ExchangeRate-API (hourly cache)\nMBC: admin-configured')
    .addFields(
      { name: '💵 Fiat Currencies', value: '\u200B', inline: false },
      ...fiatFields,
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '🏅 Precious Metals (per troy oz)', value: '\u200B', inline: false },
      ...metalFields,
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '🔮 Digital Assets', value: '\u200B', inline: false },
      { name: `${currencyEmoji('MBC')} MBC`, value: `1 MBC = \`${mbcUsd}\` USD`, inline: true },
    )
    .setFooter({ text: 'XAU/XAG = real spot price • MBC = fixed by admin' })
    .setTimestamp();
}

/**
 * Build a success embed.
 */
function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Build an error embed.
 */
function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle('❌ Error')
    .setDescription(description)
    .setTimestamp();
}

/**
 * Build a warning embed.
 */
function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(WARNING_COLOR)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Build an escrow pending embed.
 */
function escrowPendingEmbed(escrow, senderName) {
  const expiresAt = new Date(escrow.expires_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  return new EmbedBuilder()
    .setColor(WARNING_COLOR)
    .setTitle('🔒 Escrow Request')
    .setDescription(
      `**${senderName}** wants to send you **${formatAmount(escrow.amount, escrow.currency)}**\n\n` +
      (escrow.note ? `> ${escrow.note}\n\n` : '') +
      `Expires at: \`${expiresAt}\`\n\n` +
      `Click a button below to respond.`
    )
    .setFooter({ text: `Escrow ID: ${escrow.id}` })
    .setTimestamp();
}

/**
 * Build a staking info embed.
 */
function stakingInfoEmbed(position, pendingReward) {
  const started = new Date(position.started_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const lastPayout = new Date(position.last_payout_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const dailyReward = (parseFloat(position.amount) * (parseFloat(position.apr) / 365));

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('💎 MBC Staking Info')
    .addFields([
      { name: '🔒 Staked Amount', value: `\`${formatAmount(position.amount, 'MBC')}\``, inline: true },
      { name: '📈 APR', value: `\`${(parseFloat(position.apr) * 100).toFixed(2)}%\``, inline: true },
      { name: '🎁 Est. Daily Reward', value: `\`${dailyReward.toFixed(4)} MBC\``, inline: true },
      { name: '⏰ Staking Since', value: `\`${started}\``, inline: true },
      { name: '💸 Last Payout', value: `\`${lastPayout}\``, inline: true },
      { name: '⏳ Accrued (est.)', value: `\`${parseFloat(pendingReward).toFixed(4)} MBC\``, inline: true },
    ])
    .setFooter({ text: 'Rewards paid daily at 00:00 UTC' })
    .setTimestamp();
}

/**
 * Build a split bill embed.
 */
function splitBillEmbed(bill, members, initiatorName) {
  const memberLines = members.map((m) => {
    const status = m.paid ? '✅' : '⏳';
    return `${status} <@${m.discord_id}> - \`${formatAmount(m.share_amount, bill.currency)}\``;
  });

  return new EmbedBuilder()
    .setColor(INFO_COLOR)
    .setTitle('🧾 Split Bill')
    .setDescription(
      `Initiated by **${initiatorName}**\n` +
      (bill.description ? `> ${bill.description}\n` : '') +
      `\n**Total:** \`${formatAmount(bill.total_amount, bill.currency)}\`\n` +
      `**Status:** ${bill.status}\n\n` +
      memberLines.join('\n')
    )
    .setFooter({ text: `Split ID: ${bill.id}` })
    .setTimestamp();
}

module.exports = {
  BRAND_COLOR,
  SUCCESS_COLOR,
  ERROR_COLOR,
  WARNING_COLOR,
  INFO_COLOR,
  walletEmbed,
  historyEmbed,
  ratesEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  escrowPendingEmbed,
  stakingInfoEmbed,
  splitBillEmbed,
};
