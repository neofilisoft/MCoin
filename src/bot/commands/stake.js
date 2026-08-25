'use strict';
const { SlashCommandBuilder } = require('discord.js');
const stakingService = require('../../services/stakingService');
const stakingQ = require('../../db/queries/staking');
const { stakingInfoEmbed, successEmbed, errorEmbed, warningEmbed } = require('../../utils/embed');
const { parseAmount, formatAmount } = require('../../utils/currency');

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName('stake')
      .setDescription('Lock MBC to earn staking rewards')
      .addNumberOption((o) =>
        o.setName('amount').setDescription('Amount of MBC to stake').setRequired(true).setMinValue(0.0001)
      ),

    new SlashCommandBuilder()
      .setName('unstake')
      .setDescription('Withdraw your staked MBC and collect pending rewards'),

    new SlashCommandBuilder()
      .setName('staking-info')
      .setDescription('View your current MBC staking position'),
  ],

  async execute(interaction) {
    const cmd = interaction.commandName;

    if (cmd === 'stake') {
      await interaction.deferReply({ ephemeral: true });
      const rawAmount = interaction.options.getNumber('amount');
      const amount = parseAmount(rawAmount);

      if (!amount) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid amount.')] });
      }

      try {
        const apr = await stakingQ.getStakingApr();
        await stakingService.stake(interaction.user.id, amount);
        const dailyReward = (amount * apr / 365).toFixed(4);

        const embed = successEmbed(
          'Staking Started',
          `Locked **${formatAmount(amount, 'MBC')}** in staking\n` +
          `APR: \`${(apr * 100).toFixed(2)}%\`\n` +
          `Est. Daily Reward: \`${dailyReward} MBC\`\n\n` +
          `Rewards are paid daily at 00:00 UTC.`
        );

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }

    else if (cmd === 'unstake') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const { returnedAmount, rewardAmount } = await stakingService.unstake(interaction.user.id);

        const embed = successEmbed(
          'Unstaked Successfully',
          `Returned: **${formatAmount(returnedAmount, 'MBC')}**\n` +
          `Final Reward: **${formatAmount(rewardAmount, 'MBC')}**\n\n` +
          `Total returned to wallet: \`${(returnedAmount + rewardAmount).toFixed(4)} MBC\``
        );

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }

    else if (cmd === 'staking-info') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const info = await stakingService.getStakingInfo(interaction.user.id);

        if (!info) {
          return interaction.editReply({
            embeds: [warningEmbed('No Active Staking', 'You have no active staking position.\nUse `/stake <amount>` to start earning.')],
          });
        }

        const embed = stakingInfoEmbed(info.position, info.pendingReward);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed(err.message)] });
      }
    }
  },
};
