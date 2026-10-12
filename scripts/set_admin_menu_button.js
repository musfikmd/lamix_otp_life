const axios = require('axios');
require('dotenv').config();

const token = process.env.ADMIN_BOT_TOKEN;
const url = `${process.env.WEBAPP_URL}/?admin=true`;

async function setAdminMenu() {
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      menu_button: {
        type: 'web_app',
        text: '👑 Admin Panel',
        web_app: { url }
      }
    });
    console.log('Admin setChatMenuButton result:', res.data);
  } catch (err) {
    console.error('Admin setChatMenuButton error:', err.response?.data || err.message);
  }
}
setAdminMenu();
