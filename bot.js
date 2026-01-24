const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ===== Vérification du token =====
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const token = process.env.BOT_TOKEN;

// ===== Bot Telegram (polling) =====
const bot = new TelegramBot(token, { polling: true });

console.log("✅ Bot Telegram démarré");

// ===== Commande /start =====
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log("📩 /start reçu de", chatId);
  bot.sendMessage(chatId, "Bonjour");
});

// ===== Gestion erreurs polling =====
bot.on("polling_error", (err) => {
  console.error("⚠️ Polling error :", err.message);
});

// ===== Serveur Express (Railway) =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot en ligne");
});

app.listen(PORT, () => {
  console.log("🌍 Serveur actif");
});

// ===== Arrêt propre (Railway / Docker) =====
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT reçu, arrêt propre...");
  bot.stopPolling();
  process.exit(0);
});
