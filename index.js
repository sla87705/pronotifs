const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Token Telegram (mettre ici ou via Render secrets)
const token = process.env.BOT_TOKEN;

// Crée le bot en polling
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Bonjour');
});

// Express pour garder le bot actif
const app = express();
app.get("/", (req, res) => res.send("Bot en ligne !"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));

