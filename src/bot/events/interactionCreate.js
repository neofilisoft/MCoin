'use strict';
const { Events } = require('discord.js');
const escrowCommand = require('../commands/escrow');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, commands) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[Command Error] /${interaction.commandName}:`, err);
        const reply = { content: '❌ An internal error occurred.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // Handle button interactions (escrow accept/reject)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('escrow_accept_') || interaction.customId.startsWith('escrow_reject_')) {
        try {
          await escrowCommand.handleButton(interaction);
        } catch (err) {
          console.error('[Button Error] Escrow button:', err);
          await interaction.followUp({ content: '❌ An internal error occurred.', ephemeral: true }).catch(() => {});
        }
      }
    }
  },
};
