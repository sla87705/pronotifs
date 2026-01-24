/**
 * BOT TELEGRAM PRONOTE – SINGLE FILE
 * npm i node-telegram-bot-api axios node-cron tough-cookie axios-cookiejar-support
 */

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios").default;
const cron = require("node-cron");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

// ================= CONFIG =================
const TELEGRAM_TOKEN = "TELEGRAM_BOT_TOKEN";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// stockage en mémoire (simple)
const users = {}; // telegramId -> { jar, lastData }

// ================= LOGIN FLOW =================
async function loginPronote(username, password) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  // 1. Page OIDC
  await client.get(
    "https://auth.monlycee.net/realms/IDF/protocol/openid-connect/auth",
    {
      params: {
        scope: "openid profile email",
        response_type: "code",
        redirect_uri:
          "https://auth.monlycee.net/cas/login/keycloak-idf",
        client_id: "proxy-cas",
        code_challenge_method: "S256",
        code_challenge: "STATIC_CHALLENGE",
        state: "STATE",
      },
    }
  );

  // 2. Submit login
  await client.post(
    "https://auth.monlycee.net/login",
    new URLSearchParams({
      username,
      password,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return client;
}

// ================= PRONOTE FETCH =================
async function fetchPronoteData(client) {
  // ⚠️ Endpoint simplifié (exemple)
  const res = await client.get(
    "https://0931613y.index-education.net/pronote/appel",
    { params: { action: "donnees" } }
  );

  return {
    notes: res.data.notes || [],
    absences: res.data.absences || [],
  };
}

// ================= DIFF =================
function diff(oldData, newData) {
  const messages = [];

  // notes
  newData.notes.forEach((n) => {
    if (!oldData.notes.find((o) => o.id === n.id)) {
      messages.push(
        `📘 Note de ${n.matiere} : ${n.note}`
      );
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

    users[id] = {
      client,
      lastData: data,
    };

    bot.sendMessage(id, "✅ Connecté à Pronote");
  } catch (e) {
    bot.sendMessage(id, "❌ Erreur de connexion");
  }
});

// ================= CRON (5 min, 7h-22h) =================
cron.schedule("*/5 7-22 * * *", async () => {
  for (const id in users) {
    try {
      const user = users[id];
      const newData = await fetchPronoteData(user.client);

      const messages = diff(user.lastData, newData);
      messages.forEach((m) => bot.sendMessage(id, m));

      user.lastData = newData;
    } catch (e) {
      console.error("Erreur refresh", id);
    }
  }
});
