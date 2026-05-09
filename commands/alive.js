'use strict';

const fs = require('fs');
const path = require('path');
const settings = require('../settings');

async function aliveCommand(sock, chatId, message) {
    const up = process.uptime();
    const h = Math.floor(up / 3600);
    const m = Math.floor((up % 3600) / 60);
    const s = Math.floor(up % 60);
    const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const imgPath = path.join(__dirname, '../public/menu-bg.jpg');
    const caption = `╔══════════════════════╗
║  *${settings.botName}*
║  *v${settings.version}*
╚══════════════════════╝

✅ *Status:* Online & Running
⏱ *Uptime:* ${h}h ${m}m ${s}s
💾 *RAM:* ${mem} MB
👑 *Owner:* ${settings.botOwner}
📌 *Prefix:* ${settings.prefix} (dot)
💬 *Commands:* Type *.menu* to see all

> 𓆩 _WE DON'T FOLLOW RULES, WE CREATE SYSTEMS_ 𓆪`;

    try {
        if (fs.existsSync(imgPath)) {
            await sock.sendMessage(chatId, {
                image: fs.readFileSync(imgPath),
                caption
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }
}

module.exports = aliveCommand;
