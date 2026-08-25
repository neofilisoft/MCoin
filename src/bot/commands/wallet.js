'use strict';
const { SlashCommandBuilder } = require('discord.js');
const walletService = require('../../services/walletService');
const txQ = require('../../db/queries/transaction');
const { getRates } = require('../../services/rateService');
const { walletEmbed, ratesEmbed, errorEmbed, successEmbed } = require('../../utils/embed');
const { isValidCurrency, parseAmount, SUPPORTED_CURRENCIES } = require('../../utils/currency');

const CURRENCY_CHOICES = SUPPORTED_CURRENCIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: [
    // /wallet
    new SlashCommandBuilder()
      .setName('wallet')
      .setDescription('View your MCoin wallet balance'),

    // /rates
    new SlashCommandBuilder()
      .setName('rates')
      .setDescription('View current exchange rates for all currencies'),

    // /history
    new SlashCommandBuilder()
      .setName('history')
      .setDescription('View your transaction history')
      .addStringOption((o) =>
        o.setName('currency').setDescription('Filter by currency').setRequired(false).addChoices(...CURRENCY_CHOICES)
      )
      .addIntegerOption((o) =>
        o.setName('page').setDescription('Page number (default: 1)').setRequired(false).setMinValue(1)
      ),
  ],

  async execute(interaction) {
    const cmd = interaction.commandName;

    if (cmd === 'wallet') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const wallet = await walletService.getOrCreateWallet(interaction.user.id);
        const embed = walletEmbed(wallet, interaction.user.displayName || interaction.user.username);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }

    else if (cmd === 'rates') {
      await interaction.deferReply();
      try {
        const rates = await getRates();
        await interaction.editReply({ embeds: [ratesEmbed(rates)] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }

    else if (cmd === 'history') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const currency = interaction.options.getString('currency');
        const page = interaction.options.getInteger('page') || 1;

        const result = await txQ.getHistory(interaction.user.id, { currency, page, pageSize: 10 });
        const { historyEmbed } = require('../../utils/embed');
        const embed = historyEmbed(
          result.rows,
          { page: result.page, totalPages: result.totalPages, total: result.total, currency },
          interaction.user.displayName || interaction.user.username
        );
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }
  },
};
