'use strict';

const fs = require('fs');
const path = require('path');
const settings = require('../settings');

async function helpCommand(sock, chatId, message) {
    const up = process.uptime();
    const h = Math.floor(up / 3600);
    const m = Math.floor((up % 3600) / 60);

    // 1) Send menu image at the top
    const imgPath = path.join(__dirname, '../public/menu-bg.jpg');
    try {
        if (fs.existsSync(imgPath)) {
            await sock.sendMessage(chatId, {
                image: fs.readFileSync(imgPath),
                caption: `╔══════════════════════╗\n║  *${settings.botName}*\n║  *v${settings.version}* — Public System\n╚══════════════════════╝\n\n👑 *Owner:* ${settings.botOwner}\n⏱ *Uptime:* ${h}h ${m}m\n📌 *Prefix:* ${settings.prefix} (dot)\n\n_Type commands with the dot prefix below_`
            }, { quoted: message });
        }
    } catch (e) {
        console.error('[help] Image send error:', e.message);
    }

    // 2) Send commands list
    const commandsText = `╔════════════════════════╗
║   *📋 COMMAND MENU*
╚════════════════════════╝

*👑 OWNER COMMANDS*
\`\`\`
.sudo .unsudo .mode
\`\`\`

*🛡️ GROUP MANAGEMENT*
\`\`\`
.kick .ban .unban
.promote .demote
.mute .unmute
.tagall .tagnotadmin
.hidetag .setpp
.open .close
.resetlink .groupinfo
\`\`\`

*🔒 GROUP PROTECTION*
\`\`\`
.antilink .antibadword
.antitag .antidelete
.anticall .warn .warnings
.welcome .goodbye
\`\`\`

*🤖 AUTO FEATURES*
\`\`\`
.autostatus .autoread
.autotyping .chatbot
.pmblocker .areact
\`\`\`

*🎵 MEDIA & DOWNLOADS*
\`\`\`
.play .song .spotify
.tiktok .gif .igs
.instagram .facebook
\`\`\`

*🖼️ STICKERS & IMAGE*
\`\`\`
.sticker .s .attp
.take .steal .simage
.blur .removebg
.imagine .sora
.metallic .ice .snow
.neon .fire .glitch
\`\`\`

*😂 FUN & ENTERTAINMENT*
\`\`\`
.joke .quote .fact .meme
.truth .dare .8ball .ship
.compliment .insult .flirt
.simp .shayari .emojimix
\`\`\`

*🎮 GAMES*
\`\`\`
.ttt .tictactoe .move
.hangman .guess
.trivia .answer
\`\`\`

*🌐 LANGUAGE & TOOLS*
\`\`\`
.tts .translate .lyrics
.ai .gpt .ss .news
.github .staff
\`\`\`

*📋 BOT INFO*
\`\`\`
.ping .alive .bot
.owner .settings .help .menu
\`\`\`

> 𓆩 *${settings.botName}* 𓆪
> _WE DON'T FOLLOW RULES, WE CREATE SYSTEMS_`;

    await sock.sendMessage(chatId, { text: commandsText });

    // 3) Send the theme song below the menu
    const songPath = path.join(__dirname, '../public/song.mp3');
    try {
        if (fs.existsSync(songPath)) {
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(songPath),
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: message });
        }
    } catch (e) {
        console.error('[help] Song send error:', e.message);
    }
}

module.exports = helpCommand;
