const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.WEBAPP_URL || 'https://lazy-houses-shake.loca.lt';

async function setMenu() {
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      menu_button: {
        type: 'web_app',
        text: '🚀 Open App',
        web_app: { url }
      }
    });
    console.log('setChatMenuButton result:', res.data);
  } catch (err) {
    console.error('setChatMenuButton error:', err.response?.data || err.message);
  }
}
setMenu();
