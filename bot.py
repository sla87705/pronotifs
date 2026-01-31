import os
import asyncio
import telebot
from playwright.async_api import async_playwright

# Récupération du token depuis les variables d'environnement
API_TOKEN = os.environ.get('TELEGRAM_TOKEN')
bot = telebot.TeleBot(API_TOKEN)

# Fonction pour simuler une action sur le web
async def run_web_action(url):
    async with async_playwright() as p:
        # Lancement du navigateur en mode "headless" (indispensable pour les serveurs)
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page()
        
        await page.goto(url)
        
        # --- EXEMPLE D'ACTIONS ---
        # 1. Analyser le titre
        title = await page.title()
        
        # 2. Cliquer sur un bouton (remplace 'button#id' par le vrai sélecteur)
        # await page.click('button#mon-bouton') 
        
        await browser.close()
        return title

@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, "Bot prêt ! Envoie /check pour analyser une page.")

@bot.message_handler(commands=['check'])
def check_web(message):
    bot.reply_to(message, "Analyse en cours... patiente quelques secondes.")
    try:
        # On lance la fonction asynchrone pour le web
        titre_page = asyncio.run(run_web_action("https://www.google.com"))
        bot.reply_to(message, f"Analyse terminée ! Le titre de la page est : {titre_page}")
    except Exception as e:
        bot.reply_to(message, f"Erreur : {str(e)}")

print("Le bot est lancé...")
bot.infinity_polling()
