const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'warns.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getWarns(guildId, userId) {
  const data = load();
  return data[guildId]?.[userId] || [];
}

function addWarn(guildId, userId, warn) {
  const data = load();
  data[guildId] ??= {};
  data[guildId][userId] ??= [];
  data[guildId][userId].push(warn);
  save(data);
  return data[guildId][userId].length;
}

// index : numéro (1-based) ou undefined pour retirer le dernier
function removeWarn(guildId, userId, index) {
  const data = load();
  const list = data[guildId]?.[userId] || [];
  if (!list.length) return null;
  const i = index === undefined ? list.length - 1 : index - 1;
  if (i < 0 || i >= list.length) return null;
  const [removed] = list.splice(i, 1);
  save(data);
  return { removed, remaining: list.length };
}

module.exports = { getWarns, addWarn, removeWarn };
