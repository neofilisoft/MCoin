'use strict';
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const walletMod = require('./commands/wallet');
const stakeMod = require('./commands/stake');
const transferCmd = require('./commands/transfer');
const requestCmd = require('./commands/request');
const escrowCmd = require('./commands/escrow');
const splitCmd = require('./commands/split');
const exchangeCmd = require('./commands/exchange');

// Collect all SlashCommandBuilder JSON
const commandData = [
  ...(Array.isArray(walletMod.data) ? walletMod.data : [walletMod.data]),
  ...(Array.isArray(stakeMod.data) ? stakeMod.data : [stakeMod.data]),
  transferCmd.data,
  requestCmd.data,
  escrowCmd.data,
  splitCmd.data,
  exchangeCmd.data,
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      // Guild commands - instant deployment (for development)
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
        { body: commandData }
      );
      console.log(`Registered ${commandData.length} slash commands to guild ${guildId}.`);
    } else {
      // Global commands - can take up to 1 hour to propagate
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commandData }
      );
      console.log(`Registered ${commandData.length} global slash commands.`);
    }
  } catch (err) {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
  }
})();
