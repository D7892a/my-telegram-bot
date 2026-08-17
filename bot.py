import os
import threading
from flask import Flask
import telebot

# جلب توكن البوت بأمان من إعدادات Render
BOT_TOKEN = os.environ.get("BOT_TOKEN")
bot = telebot.TeleBot(BOT_TOKEN)

# 1. إنشاء سيرفر ويب بسيط لإبقاء البوت نشطاً
app = Flask(__name__)

@app.route('/')
def home():
    return "✅ البوت شغال 24/7 بدون توقف!"

def run_flask():
    # Render يحدد المنفذ تلقائياً عبر متغير PORT
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

# 2. أوامر ورسائل البوت
@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_name = message.from_user.first_name
    bot.reply_to(message, f"أهلاً بك يا {user_name}! 🚀\nالبوت شغال وسريع جداً عبر Render.")

@bot.message_handler(func=lambda msg: True)
def handle_messages(message):
    # هنا تضع برمجتك وميزات البوت
    bot.reply_to(message, f"وصلتني رسالتك: {message.text}")

# 3. التشغيل المتزامن
if __name__ == "__main__":
    # تشغيل سيرفر الويب في الخلفية
    server_thread = threading.Thread(target=run_flask)
    server_thread.start()

    # تشغيل البوت للاستماع للرسائل
    print("Bot is running...")
    bot.infinity_polling()
