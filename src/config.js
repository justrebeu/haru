module.exports = {
  prefix: '+',
  color: 0x2b2d31,

  // Rôles staff (le nom est comparé sans accents ni symboles, donc "・Helper" = "Helper").
  // Un niveau supérieur hérite des droits des niveaux inférieurs.
  staffRoles: [
    { name: '・Helper', level: 1 },
    { name: '・Modérateur', level: 2 },
    { name: '・Chef Modérateur', level: 3 },
    { name: '・Responsable Staff', level: 4 },
  ],

  // Niveau minimum requis par commande
  levels: {
    warn: 1,
    mute: 2,
    unmute: 2,
    unwarn: 2,
    lock: 3,
    unlock: 3,
    ban: 4,
    unban: 4,
    ticketmenu: 4,
  },

  // Salon où sont envoyés les logs de modération (optionnel, ignoré s'il n'existe pas)
  logChannelName: 'logs-modération',

  tickets: {
    categoryName: 'Tickets', // catégorie Discord où les tickets sont créés (créée si absente)
    categories: [
      { value: 'support', label: 'Support', description: "Besoin d'aide ou une question ?", emoji: '🛠️' },
      { value: 'partenariat', label: 'Partenariat', description: 'Proposer un partenariat', emoji: '🤝' },
      { value: 'recrutement', label: 'Recrutement', description: 'Rejoindre le staff', emoji: '📝' },
      { value: 'autre', label: 'Autre', description: 'Toute autre demande', emoji: '📩' },
    ],
  },
};
