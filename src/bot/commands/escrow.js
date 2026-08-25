'use strict';
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const escrowService = require('../../services/escrowService');
const { escrowPendingEmbed, successEmbed, errorEmbed, warningEmbed } = require('../../utils/embed');
const { parseAmount, formatAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

// Active escrow button listeners are tracked so we can respond to button clicks
// Key: `escrow_${id}`, Value: { message, escrow }
// Note: This map is in-memory only; on bot restart pending escrows are handled by scheduler.
const pendingMessages = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('escrow')
    .setDescription('Lock funds in escrow - receiver must accept within 5 minutes')
    .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
    .addStringOption((o) =>
      o.setName('currency').setDescription('Currency').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addNumberOption((o) =>
      o.setName('amount').setDescription('Amount to escrow').setRequired(true).setMinValue(0.00000001)
    )
    .addStringOption((o) =>
      o.setName('note').setDescription('Optional note').setRequired(false).setMaxLength(200)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const recipient = interaction.options.getUser('user');
    const currency = interaction.options.getString('currency');
    const rawAmount = interaction.options.getNumber('amount');
    const note = interaction.options.getString('note') || null;

    if (recipient.bot) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot escrow to a bot.')], ephemeral: true });
    }
    if (recipient.id === interaction.user.id) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot escrow to yourself.')], ephemeral: true });
    }

    const amount = parseAmount(rawAmount);
    if (!amount) {
      return interaction.editReply({ embeds: [errorEmbed('Invalid amount.')], ephemeral: true });
    }

    try {
      const escrowId = await escrowService.createEscrow(
        interaction.user.id,
        recipient.id,
        currency,
        amount,
        note
      );

      const escrow = await escrowService.getEscrow(escrowId);
      const senderName = interaction.user.displayName || interaction.user.username;
      const embed = escrowPendingEmbed(escrow, senderName);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`escrow_accept_${escrowId}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`escrow_reject_${escrowId}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      const msg = await interaction.editReply({
        content: `<@${recipient.id}> You have an escrow request!`,
        embeds: [embed],
        components: [row],
      });

      pendingMessages.set(`escrow_${escrowId}`, msg);
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(err.message)] });
    }
  },

  /**
   * Handle button interactions for escrow accept/reject.
   * Called from interactionCreate event handler.
   */
  async handleButton(interaction) {
    const [, action, idStr] = interaction.customId.split('_');
    const escrowId = parseInt(idStr);

    await interaction.deferUpdate();

    try {
      if (action === 'accept') {
        await escrowService.acceptEscrow(escrowId, interaction.user.id);
        const escrow = await escrowService.getEscrow(escrowId);

        const embed = successEmbed(
          'Escrow Completed',
          `<@${interaction.user.id}> accepted the escrow.\n` +
          `**${formatAmount(escrow.amount, escrow.currency)}** has been transferred.`
        );

        await interaction.editReply({ content: null, embeds: [embed], components: [] });
      } else if (action === 'reject') {
        await escrowService.rejectEscrow(escrowId, interaction.user.id);
        const escrow = await escrowService.getEscrow(escrowId);

        const embed = warningEmbed(
          'Escrow Rejected',
          `<@${interaction.user.id}> rejected the escrow.\n` +
          `**${formatAmount(escrow.amount, escrow.currency)}** has been refunded to <@${escrow.sender_id}>.`
        );

        await interaction.editReply({ content: null, embeds: [embed], components: [] });
      }
    } catch (err) {
      // If user is not the receiver, Discord handles it gracefully
      await interaction.followUp({ embeds: [errorEmbed(err.message)], ephemeral: true });
    }
  },
};
