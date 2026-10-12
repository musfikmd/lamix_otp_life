'use strict';

const localtunnel = require('localtunnel');
const axios = require('axios');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const CLIENT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_BOT_TOKEN;

async function updateBotButtons(url) {
  try {
    if (CLIENT_TOKEN) {
      await axios.post(`https://api.telegram.org/bot${CLIENT_TOKEN}/setChatMenuButton`, {
        menu_button: { type: 'web_app', text: '🚀 Open App', web_app: { url } }
      });
      console.log('✅ Client Bot menu button updated to:', url);
    }
    if (ADMIN_TOKEN) {
      await axios.post(`https://api.telegram.org/bot${ADMIN_TOKEN}/setChatMenuButton`, {
        menu_button: { type: 'web_app', text: '👑 Admin Panel', web_app: { url: `${url}/?admin=true` } }
      });
      console.log('✅ Admin Bot menu button updated to:', `${url}/?admin=true`);
    }
  } catch (e) {
    console.error('Error updating bot buttons:', e.response?.data || e.message);
  }
}

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: PORT });
    console.log(`===============================================`);
    console.log(`🌐 Stable HTTPS Tunnel Live: ${tunnel.url}`);
    console.log(`===============================================`);

    await updateBotButtons(tunnel.url);

    tunnel.on('close', () => {
      console.log('⚠️ Tunnel closed, reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
    });
  } catch (err) {
    console.error('Failed to start tunnel, retrying in 5s:', err.message);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
