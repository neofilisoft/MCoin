'use strict';
const { SlashCommandBuilder } = require('discord.js');
const splitService = require('../../services/splitService');
const { splitBillEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { parseAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('split')
    .setDescription('Split a bill evenly among multiple users (including yourself)')
    .addStringOption((o) =>
      o.setName('currency').setDescription('Currency').setRequired(true).addChoices(...CURRENCY_CHOICES)
    )
    .addNumberOption((o) =>
      o.setName('total').setDescription('Total amount to split').setRequired(true).setMinValue(0.00000001)
    )
    .addUserOption((o) => o.setName('user1').setDescription('Member 1 (required)').setRequired(true))
    .addUserOption((o) => o.setName('user2').setDescription('Member 2').setRequired(false))
    .addUserOption((o) => o.setName('user3').setDescription('Member 3').setRequired(false))
    .addUserOption((o) => o.setName('user4').setDescription('Member 4').setRequired(false))
    .addUserOption((o) => o.setName('user5').setDescription('Member 5').setRequired(false))
    .addStringOption((o) =>
      o.setName('description').setDescription('What this bill is for').setRequired(false).setMaxLength(200)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const currency = interaction.options.getString('currency');
    const total = interaction.options.getNumber('total');
    const description = interaction.options.getString('description') || null;

    const amount = parseAmount(total);
    if (!amount) {
      return interaction.editReply({ embeds: [errorEmbed('Invalid amount.')], ephemeral: true });
    }

    // Collect all members - initiator is automatically included
    const memberSet = new Set([interaction.user.id]);
    for (let i = 1; i <= 5; i++) {
      const u = interaction.options.getUser(`user${i}`);
      if (u) {
        if (u.bot) {
          return interaction.editReply({ embeds: [errorEmbed(`Cannot include bot users in a split bill.`)] });
        }
        memberSet.add(u.id);
      }
    }

    const memberIds = [...memberSet];

    if (memberIds.length < 2) {
      return interaction.editReply({ embeds: [errorEmbed('Need at least 2 members (you + someone else) to split.')] });
    }

    try {
      const splitId = await splitService.createSplitBill(
        interaction.user.id,
        memberIds,
        currency,
        amount,
        description
      );

      const { bill, members } = await splitService.getSplitBill(splitId);
      const initiatorName = interaction.user.displayName || interaction.user.username;
      const embed = splitBillEmbed(bill, members, initiatorName);

      const mentions = memberIds
        .filter((id) => id !== interaction.user.id)
        .map((id) => `<@${id}>`)
        .join(' ');

      await interaction.editReply({
        content: `${mentions} A split bill has been processed!`,
        embeds: [embed],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed(err.message)] });
    }
  },
};
