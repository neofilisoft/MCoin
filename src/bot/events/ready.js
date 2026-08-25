'use strict';

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: '/wallet | MCoin Bank', type: 0 }],
      status: 'online',
    });
  },
};
