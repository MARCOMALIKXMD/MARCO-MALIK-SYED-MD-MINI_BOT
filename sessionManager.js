'use strict';

/**
 * MARCO MALIK & SYED-MD MINI BOT — sessionManager.js
 * Fixed: @whiskeysockets/baileys, removed makeInMemoryStore,
 *        safe fetchLatestBaileysVersion, welcome message on connect.
 */

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const settings = require('./settings');
const config = require('./config');
const { handleMessages, handleGroupParticipantUpdate } = require('./main');

const activeSessions = new Map();
let io = null;

function setIO(ioInstance) { io = ioInstance; }
function getSessionDir(sessionId) { return path.join(config.SESSION_DIR, sessionId); }
function emitToSession(sessionId, event, data) { if (io) io.to(sessionId).emit(event, data); }

async function sendWelcomeMessage(sock) {
    try {
        // Wait a moment for the session to fully initialize
        await new Promise(r => setTimeout(r, 4000));
        const ownJid = sock.user?.id;
        if (!ownJid) return;
        const jid = ownJid.includes(':') ? ownJid.split(':')[0] + '@s.whatsapp.net' : ownJid;

        const imgPath = path.join(__dirname, 'public', 'menu-bg.jpg');
        const caption = `*Assalamualaikum! Mini Bot Connected Successfully ✅*

Welcome to our official bot.

Type *.menu* to view all available commands.

This is our official channel and bot.

╔══════════════════════╗
║  *${settings.botName}*
║  *v${settings.version}*
╚══════════════════════╝

👑 *Owner:* ${settings.botOwner}
📌 *Prefix:* ${settings.prefix} (dot)
🌐 *Mode:* Public — Everyone can use

> 𓆩 _WE DON'T FOLLOW RULES, WE CREATE SYSTEMS_ 𓆪`;

        if (fs.existsSync(imgPath)) {
            await sock.sendMessage(jid, {
                image: fs.readFileSync(imgPath),
                caption
            });
        } else {
            await sock.sendMessage(jid, { text: caption });
        }
    } catch (e) {
        console.error('[SessionManager] Welcome message error:', e.message);
    }
}

async function createSession(sessionId, usePairingCode = false, phoneNumber = null) {
    if (activeSessions.has(sessionId)) {
        console.log(`[SessionManager] Session ${sessionId} already exists.`);
        return;
    }

    const sessionDir = getSessionDir(sessionId);
    await fse.ensureDir(sessionDir);

    const logger = pino({ level: 'silent' });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // Safe version fetch with fallback
    let version = [2, 3000, 1015901307];
    try {
        const result = await fetchLatestBaileysVersion();
        if (result?.version) version = result.version;
    } catch (e) {
        console.log('[SessionManager] Using fallback baileys version.');
    }

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 20000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        getMessage: async () => ({ conversation: 'Placeholder' }),
    });

    activeSessions.set(sessionId, {
        sock,
        status: 'connecting',
        connectedAt: null,
        phoneNumber: phoneNumber || null,
    });

    // Pairing Code flow
    if (usePairingCode && phoneNumber && !sock.authState.creds.registered) {
        try {
            await new Promise(r => setTimeout(r, 3000));
            const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
            const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
            emitToSession(sessionId, 'pairing_code', { code: formatted });
            console.log(`[SessionManager] Pairing code for ${sessionId}: ${formatted}`);
        } catch (err) {
            console.error(`[SessionManager] Pairing code error: ${err.message}`);
            emitToSession(sessionId, 'error', { message: 'Failed to generate pairing code. Check your phone number and try again.' });
        }
    }

    // Connection update handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR fallback (in case someone uses QR somehow)
        if (qr && !usePairingCode) {
            try {
                const qrDataURL = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                emitToSession(sessionId, 'qr', { qr: qrDataURL });
            } catch (e) {}
        }

        if (connection === 'open') {
            const session = activeSessions.get(sessionId);
            if (session) { session.status = 'connected'; session.connectedAt = new Date(); }

            await saveCreds();
            console.log(`[SessionManager] ✅ Session ${sessionId} connected!`);

            emitToSession(sessionId, 'connected', {
                message: 'CONNECTION_ESTABLISHED — Bot is now active!',
                sessionId
            });

            // Send welcome message to the connected number
            sendWelcomeMessage(sock).catch(() => {});

            setTimeout(() => emitToSession(sessionId, 'reset_ui', {}), 5000);
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`[SessionManager] ⚠️ Session ${sessionId} closed. Reason: ${reason}`);

            if (
                reason === DisconnectReason.badSession ||
                reason === DisconnectReason.loggedOut ||
                reason === 401
            ) {
                console.log(`[SessionManager] 🔴 Session ${sessionId} logged out.`);
                emitToSession(sessionId, 'logged_out', { message: 'Session logged out. Please reconnect.' });
                await destroySession(sessionId);
            } else if (
                reason === DisconnectReason.connectionLost ||
                reason === DisconnectReason.timedOut ||
                reason === DisconnectReason.connectionClosed ||
                reason === DisconnectReason.restartRequired ||
                !reason
            ) {
                console.log(`[SessionManager] 🔄 Session ${sessionId} reconnecting...`);
                activeSessions.delete(sessionId);
                setTimeout(() => createSession(sessionId, false, null).catch(console.error), 5000);
            } else {
                await destroySession(sessionId);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (chatUpdate.type !== 'notify') return;
            await handleMessages(sock, chatUpdate, false, sessionId);
        } catch (err) {
            console.error(`[Session ${sessionId}] Message error:`, err.message);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(sock, update, sessionId);
        } catch (err) {
            console.error(`[Session ${sessionId}] Group update error:`, err.message);
        }
    });

    sock.ev.on('call', async (calls) => {
        try {
            const anticallData = getSessionData(sessionId, 'anticall', { enabled: false });
            if (!anticallData.enabled) return;
            for (const call of calls) {
                if (call.status === 'offer') {
                    await sock.rejectCall(call.id, call.from);
                    await sock.sendMessage(call.from, { text: '📵 *Auto-Rejected Call*\nCalls are blocked on this bot.' });
                }
            }
        } catch (err) {}
    });

    return sock;
}

function getSessionData(sessionId, key, defaultVal = {}) {
    try {
        const filePath = path.join(getSessionDir(sessionId), `${key}.json`);
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath));
    } catch (e) {}
    return defaultVal;
}

async function destroySession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session?.sock) { try { session.sock.end(); } catch (e) {} }
    activeSessions.delete(sessionId);
    console.log(`[SessionManager] Session ${sessionId} destroyed.`);
}

function getActiveSessions() { return activeSessions.size; }

async function restoreAllSessions() {
    const sessionsDir = config.SESSION_DIR;
    if (!fs.existsSync(sessionsDir)) return;

    const dirs = fs.readdirSync(sessionsDir).filter(d => {
        const full = path.join(sessionsDir, d);
        return fs.statSync(full).isDirectory();
    });

    console.log(`[SessionManager] Restoring ${dirs.length} session(s)...`);

    for (const sessionId of dirs) {
        try {
            const credsFile = path.join(sessionsDir, sessionId, 'creds.json');
            if (fs.existsSync(credsFile)) {
                console.log(`[SessionManager] Restoring: ${sessionId}`);
                await createSession(sessionId, false, null);
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (err) {
            console.error(`[SessionManager] Failed to restore ${sessionId}:`, err.message);
        }
    }
}

module.exports = { createSession, destroySession, getActiveSessions, restoreAllSessions, setIO, activeSessions };
