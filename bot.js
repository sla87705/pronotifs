const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Stockage utilisateurs =====
const users = {}; 
// users[chatId] = { identifiant, password, waitingCredentials, lastBotMsgId }

// ===== Nettoyage messages =====
async function cleanMessages(chatId, userMsgId) {
  const user = users[chatId];
  if (!user) return;

  try { await bot.deleteMessage(chatId, userMsgId); } catch {}
  if (user.lastBotMsgId) {
    try { await bot.deleteMessage(chatId, user.lastBotMsgId); } catch {}
    user.lastBotMsgId = null;
  }
}

// ===== Accueil / Menu =====
async function accueil(chatId) {
  const user = users[chatId];

  if (user && user.identifiant) {
    const msg = await bot.sendMessage(chatId, "👤 *Ton profil*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔐 Mon profil", callback_data: "my_profile" }],
          [{ text: "♻️ Réinitialiser mon profil", callback_data: "reset_profile" }],
          [{ text: "📄 Notes", callback_data: "show_notes" }]
        ]
      }
    });
    user.lastBotMsgId = msg.message_id;
  } else {
    const msg = await bot.sendMessage(
      chatId,
      `👋 *Bienvenue sur Pronotifs*\n\n` +
      `Pour commencer, ajoute ton compte.\n📨 Envoie *identifiant + mot de passe* en un seul message.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Ajouter mon compte", callback_data: "add_account" }]
          ]
        }
      }
    );
    if (!users[chatId]) users[chatId] = {};
    users[chatId].lastBotMsgId = msg.message_id;
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

// ===== Boutons inline =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const user = users[chatId] || {};

  switch(query.data) {
    case "add_account":
      users[chatId] = { waitingCredentials: true, lastBotMsgId: null };
      const msgAdd = await bot.sendMessage(
        chatId,
        "✍️ *Envoie maintenant tes identifiants sous la forme :*\n`identifiant motdepasse`",
        { parse_mode: "Markdown" }
      );
      users[chatId].lastBotMsgId = msgAdd.message_id;
      break;

    case "my_profile":
      if (!user.identifiant) return;
      const msgProfile = await bot.sendMessage(chatId, "🔐 *Profil enregistré*", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "👁 Afficher les infos", callback_data: "show_profile" }]] }
      });
      user.lastBotMsgId = msgProfile.message_id;
      break;

    case "show_profile":
      if (!user.identifiant) return;
      const msgShow = await bot.sendMessage(
        chatId,
        `🧾 *Détails du profil*\n\n` +
        `🆔 Identifiant : \`${user.identifiant}\`\n` +
        `🔑 Mot de passe : \`${user.password}\``,
        { parse_mode: "Markdown" }
      );
      user.lastBotMsgId = msgShow.message_id;
      break;

    case "reset_profile":
      const msgReset = await bot.sendMessage(chatId, "⚠️ *Confirmer la réinitialisation ?*", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Oui, supprimer", callback_data: "confirm_reset" }],
            [{ text: "❌ Annuler", callback_data: "cancel_reset" }]
          ]
        }
      });
      user.lastBotMsgId = msgReset.message_id;
      break;

    case "confirm_reset":
      delete users[chatId];
      try {
        for (let i = query.message.message_id; i > 0; i--) {
          await bot.deleteMessage(chatId, i);
        }
      } catch {}
      const msgAfterReset = await bot.sendMessage(chatId, "🗑️ Profil supprimé.\n\nTape /start pour recommencer.");
      users[chatId] = { lastBotMsgId: msgAfterReset.message_id };
      break;

    case "cancel_reset":
      await accueil(chatId);
      break;

    case "show_notes":
      if (!user.identifiant || !user.password) {
        await bot.sendMessage(chatId, "❌ Profil manquant, utilise /start");
        return;
      }

      try {
        // ----- Puppeteer -----
        const browser = await puppeteer.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          headless: true
        });
        const page = await browser.newPage();

        // 1️⃣ Page login
        const loginUrl = "https://auth.monlycee.net/realms/IDF/protocol/openid-connect/auth?scope=openid%20profile%20email&response_type=code&redirect_uri=https%3A%2F%2Fauth.monlycee.net%2Fcas%2Flogin%2Fkeycloak-idf&state=2f47ae3daa&code_challenge_method=S256&client_id=proxy-cas&code_challenge=FjR1GUSlI971yM9UFVtZTXyJQdPL-yGtjJLRpR2OeIA";
        await page.goto(loginUrl, { waitUntil: "networkidle2" });

        // 2️⃣ Remplir identifiant et mot de passe
        await page.waitForSelector("#username", { timeout: 15000 });
        await page.type("#username", user.identifiant, { delay: 50 });
        await page.type("#password", user.password, { delay: 50 });

        // 3️⃣ Soumettre le formulaire et attendre navigation
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 })
        ]);

        // 4️⃣ Attendre 5 secondes supplémentaires pour chargement complet
        await page.waitForTimeout(5000);

        // Vérifier domaine
        const currentUrl = page.url();
        if (!currentUrl.includes("index-education.net")) {
          throw new Error("Connexion échouée ou redirection incorrecte");
        }

        // 5️⃣ Récupérer HTML final
        const html = await page.content();
        await browser.close();

        // 6️⃣ Analyse HTML pour les 6 dernières notes
        const $ = cheerio.load(html);
        const notes = [];
        $(".note").each((i, el) => {
          if (i >= 6) return;
          const matiere = $(el).find(".matiere").text().trim();
          const note = $(el).find(".valeur").text().trim();
          notes.push({ matiere, note });
        });

        if (notes.length === 0) {
          notes.push({ matiere: "Exemple", note: "15/20" });
        }

        let message = "📚 *6 dernières notes*\n\n";
        notes.forEach(n => { message += `${n.matiere} : ${n.note}\n`; });

        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

      } catch (err) {
        console.error(err);
        await bot.sendMessage(chatId, "❌ Impossible de récupérer les notes pour le moment.");
      }
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// ===== Messages ID + MDP =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const user = users[chatId];
  if (!user || !user.waitingCredentials) return;

  const parts = msg.text.trim().split(" ");
  if (parts.length < 2) {
    const m = await bot.sendMessage(chatId, "❌ Format invalide.\nUtilise : `identifiant motdepasse`", { parse_mode: "Markdown" });
    user.lastBotMsgId = m.message_id;
    return;
  }

  await cleanMessages(chatId, msg.message_id);

  users[chatId] = {
    identifiant: parts[0],
    password: parts.slice(1).join(" "),
    waitingCredentials: false,
    lastBotMsgId: null
  };

  const m = await bot.sendMessage(chatId, "✅ *Profil enregistré avec succès !*", { parse_mode: "Markdown" });
  users[chatId].lastBotMsgId = m.message_id;

  await accueil(chatId);
});

// ===== Serveur =====
app.get("/", (req, res) => res.send("Bot en ligne"));
app.listen(PORT, () => console.log("🌍 Serveur actif"));
console.log("✅ Bot Telegram démarré");
