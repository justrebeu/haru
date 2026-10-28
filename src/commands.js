const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const store = require('./store');
const tickets = require('./tickets');
const {
  ok, err, reply, parseDuration, formatDuration, resolveUser, resolveMember, log, logEmbed, getLevel,
} = require('./utils');

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // limite Discord

// Vérifie que l'auteur peut sanctionner la cible
function hierarchyProblem(message, target) {
  if (target.id === message.author.id) return 'Tu ne peux pas te sanctionner toi-même.';
  if (target.id === message.guild.ownerId) return 'Tu ne peux pas sanctionner le propriétaire du serveur.';
  if (
    message.guild.ownerId !== message.author.id &&
    message.member.roles.highest.position <= target.roles.highest.position
  ) {
    return 'Cette personne a un rôle égal ou supérieur au tien.';
  }
  return null;
}

const dm = (user, text) => user.send(text).catch(() => {});

const commands = {
  async ban({ message, args }) {
    const user = await resolveUser(message, args[0]);
    if (!user) return reply(message, err('Usage : `+ban @membre|ID [raison]`'));
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const problem = hierarchyProblem(message, member);
      if (problem) return reply(message, err(problem));
      if (!member.bannable) return reply(message, err('Je ne peux pas bannir ce membre (mon rôle est trop bas).'));
    }

    await dm(user, `🔨 Tu as été banni de **${message.guild.name}**.\nRaison : ${reason}`);
    await message.guild.members.ban(user.id, { reason: `${message.author.tag} : ${reason}` });

    await reply(message, ok(`**${user.tag}** a été banni.\nRaison : ${reason}`));
    await log(message.guild, logEmbed('🔨 Ban', [
      { name: 'Membre', value: `${user.tag} (${user.id})` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Raison', value: reason },
    ]));
  },

  async unban({ message, args }) {
    const user = await resolveUser(message, args[0]);
    if (!user) return reply(message, err('Usage : `+unban ID [raison]`'));
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

    const banned = await message.guild.bans.fetch(user.id).catch(() => null);
    if (!banned) return reply(message, err("Cette personne n'est pas bannie."));

    await message.guild.members.unban(user.id, `${message.author.tag} : ${reason}`);
    await reply(message, ok(`**${user.tag}** a été débanni.`));
    await log(message.guild, logEmbed('♻️ Unban', [
      { name: 'Membre', value: `${user.tag} (${user.id})` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Raison', value: reason },
    ]));
  },

  // Mute = timeout Discord (28 jours max)
  async mute({ message, args }) {
    const member = await resolveMember(message, args[0]);
    if (!member) return reply(message, err('Usage : `+mute @membre [durée ex: 10m, 2h, 1d] [raison]`'));

    const problem = hierarchyProblem(message, member);
    if (problem) return reply(message, err(problem));
    if (!member.moderatable) return reply(message, err('Je ne peux pas mute ce membre (mon rôle est trop bas).'));

    let duration = parseDuration(args[1]);
    const reasonStart = duration ? 2 : 1;
    if (!duration) duration = MAX_TIMEOUT;
    if (duration > MAX_TIMEOUT) duration = MAX_TIMEOUT;
    const reason = args.slice(reasonStart).join(' ') || 'Aucune raison fournie';

    await member.timeout(duration, `${message.author.tag} : ${reason}`);
    await dm(member.user, `🔇 Tu as été mute sur **${message.guild.name}** pendant ${formatDuration(duration)}.\nRaison : ${reason}`);

    await reply(message, ok(`**${member.user.tag}** est mute pendant **${formatDuration(duration)}**.\nRaison : ${reason}`));
    await log(message.guild, logEmbed('🔇 Mute', [
      { name: 'Membre', value: `${member.user.tag} (${member.id})` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Durée', value: formatDuration(duration) },
      { name: 'Raison', value: reason },
    ]));
  },

  async unmute({ message, args }) {
    const member = await resolveMember(message, args[0]);
    if (!member) return reply(message, err('Usage : `+unmute @membre`'));
    if (!member.isCommunicationDisabled()) return reply(message, err("Ce membre n'est pas mute."));

    await member.timeout(null, `Unmute par ${message.author.tag}`);
    await reply(message, ok(`**${member.user.tag}** n'est plus mute.`));
    await log(message.guild, logEmbed('🔊 Unmute', [
      { name: 'Membre', value: `${member.user.tag} (${member.id})` },
      { name: 'Modérateur', value: `${message.author}` },
    ]));
  },

  async warn({ message, args }) {
    const member = await resolveMember(message, args[0]);
    if (!member) return reply(message, err('Usage : `+warn @membre [raison]`'));
    const problem = hierarchyProblem(message, member);
    if (problem) return reply(message, err(problem));
    const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

    const total = store.addWarn(message.guild.id, member.id, {
      moderator: message.author.id,
      reason,
      date: Date.now(),
    });

    await dm(member.user, `⚠️ Tu as reçu un avertissement sur **${message.guild.name}**.\nRaison : ${reason}`);
    await reply(message, ok(`**${member.user.tag}** a été warn (**${total}** warn${total > 1 ? 's' : ''}).\nRaison : ${reason}`));
    await log(message.guild, logEmbed('⚠️ Warn', [
      { name: 'Membre', value: `${member.user.tag} (${member.id})` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Raison', value: reason },
      { name: 'Total', value: String(total) },
    ]));
  },

  // +unwarn @membre [numéro] : retire le warn n°X, ou le dernier si aucun numéro
  async unwarn({ message, args }) {
    const member = await resolveMember(message, args[0]);
    if (!member) return reply(message, err('Usage : `+unwarn @membre [numéro]`'));

    const index = args[1] ? parseInt(args[1], 10) : undefined;
    if (args[1] && Number.isNaN(index)) return reply(message, err('Le numéro du warn est invalide.'));

    const result = store.removeWarn(message.guild.id, member.id, index);
    if (!result) return reply(message, err('Aucun warn correspondant pour ce membre.'));

    await reply(message, ok(`Un warn de **${member.user.tag}** a été retiré (${result.remaining} restant${result.remaining > 1 ? 's' : ''}).`));
    await log(message.guild, logEmbed('✅ Unwarn', [
      { name: 'Membre', value: `${member.user.tag} (${member.id})` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Warn retiré', value: result.removed.reason },
    ]));
  },

  // +lock [#salon] [raison]
  async lock({ message, args }) {
    const channel = message.mentions.channels.first() || message.channel;
    const reason = args.filter((a) => !a.startsWith('<#')).join(' ') || 'Aucune raison fournie';

    await channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false },
      { reason: `${message.author.tag} : ${reason}` },
    );
    await reply(message, ok(`${channel} est verrouillé 🔒`));
    await log(message.guild, logEmbed('🔒 Lock', [
      { name: 'Salon', value: `${channel}` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Raison', value: reason },
    ]));
  },

  async unlock({ message }) {
    const channel = message.mentions.channels.first() || message.channel;
    await channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: null },
      { reason: `Unlock par ${message.author.tag}` },
    );
    await reply(message, ok(`${channel} est déverrouillé 🔓`));
    await log(message.guild, logEmbed('🔓 Unlock', [
      { name: 'Salon', value: `${channel}` },
      { name: 'Modérateur', value: `${message.author}` },
    ]));
  },

  // +clear [nombre] : supprime entre 1 et 100 messages (ceux de moins de 14 jours)
  async clear({ message, args }) {
    const amount = parseInt(args[0], 10);
    if (!amount || amount < 1 || amount > 100) {
      return reply(message, err('Usage : `+clear [nombre entre 1 et 100]`'));
    }

    await message.delete().catch(() => {});
    const deleted = await message.channel.bulkDelete(amount, true);

    const confirm = await message.channel.send({
      embeds: [ok(`**${deleted.size}** message${deleted.size > 1 ? 's' : ''} supprimé${deleted.size > 1 ? 's' : ''}.`)],
    });
    setTimeout(() => confirm.delete().catch(() => {}), 3000);

    await log(message.guild, logEmbed('🧹 Clear', [
      { name: 'Salon', value: `${message.channel}` },
      { name: 'Modérateur', value: `${message.author}` },
      { name: 'Messages supprimés', value: String(deleted.size) },
    ]));
  },

  // +help : affiche les commandes accessibles au membre selon son niveau
  async help({ message }) {
    const level = getLevel(message.member);
    const p = config.prefix;
    const entries = [
      [`${p}warn @membre [raison]`, 'Avertit un membre', 'warn'],
      [`${p}mute @membre [durée] [raison]`, 'Rend muet (ex: 10m, 2h, 1d)', 'mute'],
      [`${p}unmute @membre`, 'Retire le mute', 'unmute'],
      [`${p}unwarn @membre [numéro]`, 'Retire un warn', 'unwarn'],
      [`${p}clear [nombre]`, 'Supprime des messages (1-100)', 'clear'],
      [`${p}lock [#salon] [raison]`, 'Verrouille un salon', 'lock'],
      [`${p}unlock [#salon]`, 'Déverrouille un salon', 'unlock'],
      [`${p}ban @membre|ID [raison]`, 'Bannit un membre', 'ban'],
      [`${p}unban ID [raison]`, 'Débannit un membre', 'unban'],
      [`${p}ticketmenu`, 'Envoie le menu des tickets', 'ticketmenu'],
    ].filter(([, , name]) => level >= config.levels[name]);

    const description = entries.length
      ? entries.map(([usage, desc]) => `\`${usage}\`\n↳ ${desc}`).join('\n\n')
      : "Tu n'as accès à aucune commande de modération.";

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle('Aide Haru')
      .setDescription(description)
      .setFooter({ text: `Préfixe : ${p} • Niveau : ${level}` });

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },

  // Envoie le menu de tickets dans le salon courant
  async ticketmenu({ message }) {
    await tickets.sendMenu(message.channel);
    await message.delete().catch(() => {});
  },
};

module.exports = commands;
