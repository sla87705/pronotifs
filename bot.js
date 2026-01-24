const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Token Telegram (à mettre dans Render environment variable)
const token = process.env.BOT_TOKEN;

// Crée le bot en mode polling
const bot = new TelegramBot(token, { polling: true });

// Log pour confirmer que le bot est connecté
console.log("Bot Telegram démarré et connecté !");

// Quand quelqu'un envoie /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log("Message reçu de", chatId, ":", msg.text);
  bot.sendMessage(chatId, 'Bonjour');
});

// Serveur Express pour garder le bot actif sur Render
const app = express();
app.get("/", (req, res) => res.send("Bot en ligne !"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));
