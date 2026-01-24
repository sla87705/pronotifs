const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Stockage temporaire utilisateurs =====
const users = {}; 
// users[chatId] = { step, identifiant, password, messagesToDelete: [] }

// ===== Utilitaire nettoyage =====
async function cleanChat(chatId) {
  if (!users[chatId]) return;
  for (const msgId of users[chatId].messagesToDelete || []) {
    try {
      await bot.deleteMessage(chatId, msgId);
    } catch {}
  }
  users[chatId].messagesToDelete = [];
}

// ===== Accueil =====
async function showAccueil(chatId) {
  users[chatId] = { messagesToDelete: [] };

  const msg = await bot.sendMessage(
    chatId,
    `👋 *Bienvenue sur Pronotifs*\n\n` +
    `Ce bot te permet de recevoir des notifications lorsqu’une nouvelle information apparaît sur ton compte.\n\n` +
    `🔐 Tes identifiants sont utilisés uniquement pour la connexion automatique.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Ajouter mon compte", callback_data: "add_account" }]
        ]
      }
    }
  );

  users[chatId].messagesToDelete.push(msg.message_id);
}

// ===== Commandes =====
bot.onText(/\/start|\/accueil/, async (msg) => {
  await showAccueil(msg.chat.id);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📖 *Commandes disponibles*\n\n` +
    `/start ou /accueil – Accueil du bot\n` +
    `/help – Afficher cette aide\n\n` +
    `ℹ️ Utilise les boutons pour ajouter ou modifier ton compte.`,
    { parse_mode: "Markdown" }
  );
});

// ===== Boutons =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;

  if (!users[chatId]) users[chatId] = { messagesToDelete: [] };

  if (query.data === "add_account") {
    await cleanChat(chatId);
    users[chatId].step = "identifiant";

    const msg = await bot.sendMessage(
      chatId,
      "🆔 *Entre ton identifiant* :",
      { parse_mode: "Markdown" }
    );

    users[chatId].messagesToDelete.push(msg.message_id);
  }

  await bot.answerCallbackQuery(query.id);
});

// ===== Réception messages =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId] || !users[chatId].step) return;

  // Supprimer le message de l'utilisateur (sécurité)
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch {}

  if (users[chatId].step === "identifiant") {
    users[chatId].identifiant = msg.text;
    users[chatId].step = "password";

    const m = await bot.sendMessage(
      chatId,
      "🔑 *Entre ton mot de passe* :",
      { parse_mode: "Markdown" }
    );

    users[chatId].messagesToDelete.push(m.message_id);
    return;
  }

  if (users[chatId].step === "password") {
    users[chatId].password = msg.text;
    users[chatId].step = null;

    await cleanChat(chatId);

    bot.sendMessage(
      chatId,
      "✅ *Profil enregistré avec succès !*\n\nTu pourras modifier ton compte à tout moment avec /accueil",
      { parse_mode: "Markdown" }
    );

    console.log("📦 Profil enregistré :", chatId, users[chatId]);
  }
});

// ===== Serveur =====
app.get("/", (req, res) => res.send("Bot en ligne"));
app.listen(PORT, () => console.log("🌍 Serveur actif"));
console.log("✅ Bot Telegram démarré");
