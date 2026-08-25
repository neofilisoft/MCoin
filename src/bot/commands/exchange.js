'use strict';
const { SlashCommandBuilder } = require('discord.js');
const exchangeService = require('../../services/exchangeService');
const { getRates } = require('../../services/rateService');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { parseAmount, formatAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exchange')
    .setDescription('Exchange one currency for another in your wallet')
    .addStringOption((o) =>
      o.setName('from').setDescription('Currency to sell').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addStringOption((o) =>
      o.setName('to').setDescription('Currency to buy').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addNumberOption((o) =>
      o.setName('amount').setDescription('Amount of the FROM currency').setRequired(true).setMinValue(0.00000001)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const from = interaction.options.getString('from');
    const to = interaction.options.getString('to');
    const rawAmount = interaction.options.getNumber('amount');

    if (from === to) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot exchange a currency for itself.')] });
    }

    const amount = parseAmount(rawAmount);
    if (!amount) {
      return interaction.editReply({ embeds: [errorEmbed('Invalid amount.')] });
    }

    try {
      const { txid, toAmount, rate } = await exchangeService.exchange(
        interaction.user.id,
        from,
        to,
        amount
      );

      const embed = successEmbed(
        'Exchange Successful',
        `Exchanged **${formatAmount(amount, from)}** → **${formatAmount(toAmount, to)}**\n` +
        `Rate: \`1 ${from} = ${rate.toFixed(8)} ${to}\`\n\n` +
        `\`TXID: ${txid.slice(0, 16)}...\``
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(err.message)] });
    }
  },
};
