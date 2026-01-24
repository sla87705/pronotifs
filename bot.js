const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

console.log("✅ Bot Telegram démarré");

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Bonjour");
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot en ligne"));
app.listen(PORT, () => console.log("🌍 Serveur actif"));
