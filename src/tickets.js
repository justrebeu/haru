const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
} = require('discord.js');
const config = require('./config');
const { getLevel, roleLevel, norm } = require('./utils');

const MENU_ID = 'haru_ticket_menu';
const CLOSE_ID = 'haru_ticket_close';

function buildMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(MENU_ID)
    .setPlaceholder('Choisir une catégorie...')
    .addOptions(
      config.tickets.categories.map((c) => ({
        label: c.label,
        description: c.description,
        value: c.value,
        emoji: c.emoji,
      })),
    );
  return new ActionRowBuilder().addComponents(menu);
}

async function sendMenu(channel) {
  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle('Tickets Haru')
    .setDescription('↳ Le support du serveur est disponible 24h/24 !');
  await channel.send({ embeds: [embed], components: [buildMenu()] });
}

function staffRoles(guild) {
  return guild.roles.cache.filter((r) => roleLevel(r.name) > 0);
}

async function getCategory(guild) {
  const wanted = norm(config.tickets.categoryName);
  let cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && norm(c.name) === wanted,
  );
  if (!cat) {
    cat = await guild.channels.create({
      name: config.tickets.categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });
  }
  return cat;
}

async function handleMenu(interaction) {
  const { guild, user, values } = interaction;
  const category = config.tickets.categories.find((c) => c.value === values[0]);

  // Remet le menu à zéro (aucune sélection affichée)
  await interaction.message.edit({ components: [buildMenu()] }).catch(() => {});

  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.topic === `ticket:${user.id}`,
  );
  if (existing) {
    return interaction.reply({
      content: `❌ Tu as déjà un ticket ouvert : ${existing}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const parent = await getCategory(guild);
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow },
    {
      id: guild.members.me.id,
      allow: [...allow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks],
    },
    ...staffRoles(guild).map((r) => ({ id: r.id, allow })),
  ];

  const channel = await guild.channels.create({
    name: `${category.value}-${user.username}`.slice(0, 100),
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `ticket:${user.id}`,
    permissionOverwrites: overwrites,
  });

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(`Ticket ${category.label}`)
    .setDescription(
      `Bienvenue ${user}, explique ta demande ici.\nUn membre du staff te répondra dès que possible.`,
    );

  const close = new ButtonBuilder()
    .setCustomId(CLOSE_ID)
    .setLabel('Fermer le ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  await channel.send({
    content: `${user}`,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(close)],
  });

  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
}

async function handleClose(interaction) {
  const { channel, user, member } = interaction;
  const isOwner = channel.topic === `ticket:${user.id}`;
  if (!isOwner && getLevel(member) < 1) {
    return interaction.reply({
      content: '❌ Seul le staff ou le créateur du ticket peut le fermer.',
      ephemeral: true,
    });
  }
  await interaction.reply('🔒 Ticket fermé, suppression du salon dans 5 secondes...');
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function handleInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === MENU_ID) return handleMenu(interaction);
  if (interaction.isButton() && interaction.customId === CLOSE_ID) return handleClose(interaction);
}

module.exports = { sendMenu, handleInteraction };
