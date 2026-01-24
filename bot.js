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
// users[chatId] = { identifiant, password, waitingCredentials }

// ===== Accueil =====
async function accueil(chatId) {
  const user = users[chatId];

  if (user && user.identifiant) {
    // Profil déjà existant
    await bot.sendMessage(chatId, "👤 *Ton profil*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Mon profil", callback_data: "my_profile" }],
          [{ text: "♻️ Réinitialiser mon profil", callback_data: "reset_profile" }]
        ]
      }
    });
  } else {
    await bot.sendMessage(
      chatId,
      `👋 *Bienvenue sur Pronotifs*\n\n` +
      `Pour commencer, ajoute ton compte.\n\n` +
      `📨 Tu devras envoyer *identifiant + mot de passe* en un seul message.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Ajouter mon compte", callback_data: "add_account" }]
          ]
        }
      }
    );
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
    users[chatId] = { waitingCredentials: true };

    await bot.sendMessage(
      chatId,
      "✍️ *Envoie maintenant tes identifiants sous la forme :*\n\n`identifiant motdepasse`",
      { parse_mode: "Markdown" }
    );
  }

  if (query.data === "my_profile") {
    await bot.sendMessage(chatId, "🔐 *Profil enregistré*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👁 Afficher les infos", callback_data: "show_profile" }]
        ]
      }
    });
  }

  if (query.data === "show_profile") {
    await bot.sendMessage(
      chatId,
      `🧾 *Détails du profil*\n\n` +
      `🆔 Identifiant : \`${user.identifiant}\`\n` +
      `🔑 Mot de passe : \`${user.password}\``,
      { parse_mode: "Markdown" }
    );
  }

  if (query.data === "reset_profile") {
    await bot.sendMessage(chatId, "⚠️ *Confirmer la réinitialisation ?*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Oui, supprimer", callback_data: "confirm_reset" }],
          [{ text: "❌ Annuler", callback_data: "cancel_reset" }]
        ]
      }
    });
  }

  if (query.data === "confirm_reset") {
    delete users[chatId];

    // Nettoyage discussion (best effort)
    try {
      for (let i = query.message.message_id; i > 0; i--) {
        await bot.deleteMessage(chatId, i);
      }
    } catch {}

    await bot.sendMessage(chatId, "🗑️ Profil supprimé.\n\nTape /start pour recommencer.");
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
    await bot.sendMessage(chatId, "❌ Format invalide.\nUtilise : `identifiant motdepasse`", {
      parse_mode: "Markdown"
    });
    return;
  }

  // Supprimer le message sensible
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch {}

  users[chatId] = {
    identifiant: parts[0],
    password: parts.slice(1).join(" "),
    waitingCredentials: false
  };

  await bot.sendMessage(chatId, "✅ *Profil enregistré avec succès !*", {
    parse_mode: "Markdown"
  });

  await accueil(chatId);
});

// ===== Serveur =====
app.get("/", (req, res) => res.send("Bot en ligne"));
app.listen(PORT, () => console.log("🌍 Serveur actif"));
console.log("✅ Bot Telegram démarré");
