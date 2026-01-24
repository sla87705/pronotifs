/**
 * BOT TELEGRAM MINIMAL – Répond à /start
 */

const TelegramBot = require("node-telegram-bot-api");

// ⚠️ Token via variable d'environnement
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN non défini !");
  process.exit(1);
}

// Crée le bot en mode polling
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot prêt et en ligne !");

// Réponse à la commande /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Bonjour ! Je suis ton bot Telegram ✅");
});
