'use strict';
const { SlashCommandBuilder } = require('discord.js');
const transferService = require('../../services/transferService');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { isValidCurrency, parseAmount, formatAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Send currency to another Discord user')
    .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
    .addStringOption((o) =>
      o.setName('currency').setDescription('Currency to send').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addNumberOption((o) =>
      o.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(0.00000001)
    )
    .addStringOption((o) =>
      o.setName('note').setDescription('Optional note/memo').setRequired(false).setMaxLength(200)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const recipient = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const rawAmount = interaction.options.getNumber('amount');
    const note = interaction.options.getString('note') || null;

    if (recipient.bot) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot transfer to a bot.')] });
    }
    if (recipient.id === interaction.user.id) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot transfer to yourself.')] });
    }

    const amount = parseAmount(rawAmount);
    if (!amount) {
      return interaction.editReply({ embeds: [errorEmbed('Invalid amount.')] });
    }

    try {
      const txid = await transferService.transfer(
        interaction.user.id,
        recipient.id,
        currency,
        amount,
        note
      );

      const embed = successEmbed(
        'Transfer Successful',
        `Sent **${formatAmount(amount, currency)}** to <@${recipient.id}>\n` +
        (note ? `> ${note}\n` : '') +
        `\n\`TXID: ${txid.slice(0, 16)}...\``
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(err.message)] });
    }
  },
};
