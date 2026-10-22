const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function roleLevel(roleName) {
  const n = norm(roleName);
  const found = config.staffRoles.find((r) => norm(r.name) === n);
  return found ? found.level : 0;
}

function getLevel(member) {
  if (!member) return 0;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return 4;
  let level = 0;
  for (const role of member.roles.cache.values()) level = Math.max(level, roleLevel(role.name));
  return level;
}

const ok = (description) => new EmbedBuilder().setColor(0x57f287).setDescription(`✅ ${description}`);
const err = (description) => new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${description}`);

const reply = (message, embed) =>
  message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

const UNITS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

function parseDuration(str) {
  const m = /^(\d+)(s|m|h|d)$/i.exec(str || '');
  return m ? Number(m[1]) * UNITS[m[2].toLowerCase()] : null;
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [d && `${d}j`, h && `${h}h`, m && `${m}min`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

async function resolveUser(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, '');
  if (!/^\d{17,20}$/.test(id)) return null;
  return message.client.users.fetch(id).catch(() => null);
}

async function resolveMember(message, arg) {
  const user = await resolveUser(message, arg);
  if (!user) return null;
  return message.guild.members.fetch(user.id).catch(() => null);
}

async function log(guild, embed) {
  const wanted = norm(config.logChannelName);
  const channel = guild.channels.cache.find((c) => c.isTextBased() && norm(c.name) === wanted);
  if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
}

function logEmbed(title, fields) {
  return new EmbedBuilder()
    .setColor(config.color)
    .setTitle(title)
    .addFields(fields)
    .setTimestamp();
}

module.exports = {
  norm, roleLevel, getLevel, ok, err, reply,
  parseDuration, formatDuration, resolveUser, resolveMember, log, logEmbed,
};
