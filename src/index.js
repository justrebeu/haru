require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const tickets = require('./tickets');
const { getLevel, err, reply } = require('./utils');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', () => {
  console.log(`Haru connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const name = args.shift()?.toLowerCase();
  const command = commands[name];
  if (!command) return;

  const required = config.levels[name] ?? 4;
  if (getLevel(message.member) < required) {
    return reply(message, err("Tu n'as pas la permission d'utiliser cette commande."));
  }

  try {
    await command({ message, args });
  } catch (e) {
    console.error(`Erreur sur +${name} :`, e);
    reply(message, err('Une erreur est survenue en exécutant cette commande.')).catch(() => {});
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    await tickets.handleInteraction(interaction);
  } catch (e) {
    console.error('Erreur interaction :', e);
    const payload = { content: '❌ Une erreur est survenue.', ephemeral: true };
    if (interaction.deferred || interaction.replied) interaction.followUp(payload).catch(() => {});
    else interaction.reply(payload).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
