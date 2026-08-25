'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed } = require('../../utils/embed');
const { formatAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');
const { INFO_COLOR } = require('../../utils/embed');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('request')
    .setDescription('Send a payment request to another Discord user')
    .addUserOption((o) => o.setName('user').setDescription('Who to request from').setRequired(true))
    .addStringOption((o) =>
      o.setName('currency').setDescription('Currency').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addNumberOption((o) =>
      o.setName('amount').setDescription('Amount to request').setRequired(true).setMinValue(0.00000001)
    )
    .addStringOption((o) =>
      o.setName('note').setDescription('Reason for request').setRequired(false).setMaxLength(200)
    ),

  async execute(interaction) {
    // Payment request is informational - it notifies the target user via a visible message
    // The target must then manually run /transfer to pay.
    // This keeps it simple and prevents auto-deduction without consent.

    const target = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getNumber('amount');
    const note = interaction.options.getString('note') || null;

    if (target.bot) {
      return interaction.reply({ embeds: [errorEmbed('Cannot request from a bot.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Cannot request from yourself.')], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(INFO_COLOR)
      .setTitle('💸 Payment Request')
      .setDescription(
        `<@${target.id}>, **${interaction.user.displayName || interaction.user.username}** is requesting payment from you.\n\n` +
        `**Amount:** \`${formatAmount(amount, currency)}\`\n` +
        (note ? `**Note:** ${note}\n\n` : '\n') +
        `To pay, use:\n` +
        `\`/transfer user:${interaction.user.username} currency:${currency} amount:${amount}\``
      )
      .setFooter({ text: 'MCoin Bank • Payment Request' })
      .setTimestamp();

    // Reply publicly so the target user sees it
    await interaction.reply({ content: `<@${target.id}>`, embeds: [embed] });
  },
};
