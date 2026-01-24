/**
 * BOT TELEGRAM MINIMAL – TEST
 * Répond à /start
 */

const TelegramBot = require("node-telegram-bot-api");

// ⚠️ Token via variable d'environnement
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

// Vérification du token
if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN non défini !");
  process.exit(1);
} else {
  console.log("✅ TELEGRAM_TOKEN détecté !");
}

// Création du bot en mode polling
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot Telegram prêt et en ligne !");

// Test pour tout message reçu
bot.on("message", (msg) => {
  console.log("Message reçu de", msg.chat.id, ":", msg.text);
});

// Réponse uniquement à /start
bot.onText(/\/start/, (msg) => {
  console.log("/start reçu de", msg.chat.id);
  bot.sendMessage(msg.chat.id, "Bonjour ! Je suis ton bot Telegram ✅");
});
