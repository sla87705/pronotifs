/**
 * BOT TELEGRAM PRONOTE – CLEAN VERSION
 * Node.js + TelegramBot + cron
 * Utiliser Railway ou Replit
 */

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios").default;
const cron = require("node-cron");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

// ================= CONFIG =================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN non défini !");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Stockage temporaire des utilisateurs
const users = {}; // telegramId -> { client, lastData }

// ================= LOGIN PRONOTE SIMPLIFIÉ =================
async function loginPronote(username, password) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  // ⚠️ Simplifié pour l’exemple
  // Ici tu mettra ton vrai flow MonLycée / Pronote
  console.log(`Connexion Pronote pour ${username}...`);
  return client;
}

// ================= FETCH PRONOTE =================
async function fetchPronoteData(client) {
  // ⚠️ Endpoint simplifié
  return {
    notes: [], // tableau d’exemple
    absences: [],
  };
}

// ================= DIFF =================
function diff(oldData, newData) {
  const messages = [];

  // notes
  newData.notes.forEach((n) => {
    if (!oldData.notes.find((o) => o.id === n.id)) {
      messages.push(`📘 Note de ${n.matiere} : ${n.note}`);
    }
  });

  // absences
  newData.absences.forEach((a) => {
    if (!oldData.absences.find((o) => o.id === a.id)) {
      messages.push(
        `🚫 Absence de ${a.matiere} le ${a.date} de ${a.debut} à ${a.fin}`
      );
    }
  });

  return messages;
}

// ================= TELEGRAM =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Identifiant puis mot de passe (2 messages séparés)"
  );
});

const tempAuth = {};

bot.on("message", async (msg) => {
  const id = msg.chat.id;
  if (msg.text.startsWith("/")) return;

  if (!tempAuth[id]) {
    tempAuth[id] = { username: msg.text };
    bot.sendMessage(id, "Mot de passe ?");
    return;
  }

  const { username } = tempAuth[id];
  const password = msg.text;
  delete tempAuth[id];

  bot.sendMessage(id, "Connexion en cours...");

  try {
    const client = await loginPronote(username, password);
    const data = await fetchPronoteData(client);

    users[id] = { client, lastData: data };
    bot.sendMessage(id, "✅ Connecté à Pronote");
  } catch (e) {
    bot.sendMessage(id, "❌ Erreur de connexion");
    console.error(e);
  }
});

// ================= CRON =================
cron.schedule("*/5 7-22 * * *", async () => {
  for (const id in users) {
    try {
      const user = users[id];
      const newData = await fetchPronoteData(user.client);

      const messages = diff(user.lastData, newData);
      messages.forEach((m) => bot.sendMessage(id, m));

      user.lastData = newData;
    } catch (e) {
      console.error("Erreur refresh", id, e);
    }
  }
});

console.log("🤖 Bot Telegram prêt et en ligne !");
