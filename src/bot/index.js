'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { initScheduler } = require('../services/scheduler');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Load commands into a collection
const commands = new Collection();

// Commands that export a single command object
const singleCommands = [
  require('./commands/transfer'),
  require('./commands/request'),
  require('./commands/escrow'),
  require('./commands/split'),
  require('./commands/exchange'),
];

// Commands that export an array of command objects
const multiCommands = [
  require('./commands/wallet'),
  require('./commands/stake'),
];

for (const cmd of singleCommands) {
  commands.set(cmd.data.name, cmd);
}

for (const mod of multiCommands) {
  const list = Array.isArray(mod.data) ? mod.data : [mod.data];
  for (const cmdData of list) {
    commands.set(cmdData.name, mod);
  }
}

// Load events
const readyEvent = require('./events/ready');
const interactionEvent = require('./events/interactionCreate');

client.once(readyEvent.name, (...args) => readyEvent.execute(...args));
client.on(interactionEvent.name, (interaction) => interactionEvent.execute(interaction, commands));

// Start
(async () => {
  // Initialize scheduled jobs (staking payout + escrow timeout)
  initScheduler();

  await client.login(process.env.DISCORD_TOKEN);
})().catch((err) => {
  console.error('[Bot] Fatal error during startup:', err);
  process.exit(1);
});

module.exports = client;
