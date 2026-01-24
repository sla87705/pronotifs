const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Stockage mémoire =====
const users = {}; 
// users[chatId] = { identifiant, password, waitingCredentials, lastBotMsgId }

// ===== Supprimer avant-dernier message du bot + message utilisateur =====
async function cleanMessages(chatId, userMsgId) {
  const user = users[chatId];
  if (!user) return;

  // Supprime le message de l'utilisateur
  try {
    await bot.deleteMessage(chatId, userMsgId);
  } catch {}

  // Supprime l’avant-dernier message du bot (lastBotMsgId)
  if (user.lastBotMsgId) {
    try {
      await bot.deleteMessage(chatId, user.lastBotMsgId);
    } catch {}
    user.lastBotMsgId = null; // réinitialise
  }
}

// ===== Accueil =====
async function accueil(chatId) {
  const user = users[chatId];

  if (user && user.identifiant) {
    // Profil déjà existant
    const msg = await bot.sendMessage(chatId, "👤 *Ton profil*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Mon profil", callback_data: "my_profile" }],
          [{ text: "♻️ Réinitialiser mon profil", callback_data: "reset_profile" }]
        ]
      }
    });
    user.lastBotMsgId = msg.message_id;
  } else {
    const msg = await bot.sendMessage(
      chatId,
      `👋 *Bienvenue sur Pronotifs*\n\n` +
      `Pour commencer, ajoute ton compte.\n📨 Envoie *identifiant + mot de passe* en un seul message.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Ajouter mon compte", callback_data: "add_account" }]
          ]
        }
      }
    );
    if (!users[chatId]) users[chatId] = {};
    users[chatId].lastBotMsgId = msg.message_id;
  }
}

// ===== Commandes =====
bot.onText(/\/start|\/accueil/, async (msg) => {
  await accueil(msg.chat.id);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📖 *Commandes*\n\n` +
    `/start ou /accueil – Accueil\n` +
    `/help – Aide\n\n` +
    `ℹ️ Utilise les boutons pour gérer ton profil.`,
    { parse_mode: "Markdown" }
  );
});

// ===== Boutons =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const user = users[chatId] || {};

  if (query.data === "add_account") {
    users[chatId] = { waitingCredentials: true, lastBotMsgId: null };

    const msg = await bot.sendMessage(
      chatId,
      "✍️ *Envoie maintenant tes identifiants sous la forme :*\n`identifiant motdepasse`",
      { parse_mode: "Markdown" }
    );

    users[chatId].lastBotMsgId = msg.message_id;
  }

  if (query.data === "my_profile") {
    const msg = await bot.sendMessage(chatId, "🔐 *Profil enregistré*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁 Afficher les infos", callback_data: "show_profile" }]
        ]
      }
    });
    user.lastBotMsgId = msg.message_id;
  }

  if (query.data === "show_profile") {
    const msg = await bot.sendMessage(
      chatId,
      `🧾 *Détails du profil*\n\n` +
      `🆔 Identifiant : \`${user.identifiant}\`\n` +
      `🔑 Mot de passe : \`${user.password}\``,
      { parse_mode: "Markdown" }
    );
    user.lastBotMsgId = msg.message_id;
  }

  if (query.data === "reset_profile") {
    const msg = await bot.sendMessage(chatId, "⚠️ *Confirmer la réinitialisation ?*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Oui, supprimer", callback_data: "confirm_reset" }],
          [{ text: "❌ Annuler", callback_data: "cancel_reset" }]
        ]
      }
    });
    user.lastBotMsgId = msg.message_id;
  }

  if (query.data === "confirm_reset") {
    delete users[chatId];

    try {
      for (let i = query.message.message_id; i > 0; i--) {
        await bot.deleteMessage(chatId, i);
      }
    } catch {}

    const msg = await bot.sendMessage(chatId, "🗑️ Profil supprimé.\n\nTape /start pour recommencer.");
    users[chatId] = { lastBotMsgId: msg.message_id };
  }

  if (query.data === "cancel_reset") {
    await accueil(chatId);
  }

  bot.answerCallbackQuery(query.id);
});

// ===== Messages (ID + MDP) =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const user = users[chatId];

  if (!user || !user.waitingCredentials) return;

  const parts = msg.text.trim().split(" ");
  if (parts.length < 2) {
    const m = await bot.sendMessage(chatId, "❌ Format invalide.\nUtilise : `identifiant motdepasse`", {
      parse_mode: "Markdown"
    });
    user.lastBotMsgId = m.message_id;
    return;
  }

  await cleanMessages(chatId, msg.message_id);

  users[chatId] = {
    identifiant: parts[0],
    password: parts.slice(1).join(" "),
    waitingCredentials: false,
    lastBotMsgId: null
  };

  const m = await bot.sendMessage(chatId, "✅ *Profil enregistré avec succès !*", { parse_mode: "Markdown" });
  users[chatId].lastBotMsgId = m.message_id;

  await accueil(chatId);
});

// ===== Serveur =====
app.get("/", (req, res) => res.send("Bot en ligne"));
app.listen(PORT, () => console.log("🌍 Serveur actif"));
console.log("✅ Bot Telegram démarré");
