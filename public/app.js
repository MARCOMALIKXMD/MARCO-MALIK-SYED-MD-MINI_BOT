'use strict';

const socket = io({ transports: ['websocket', 'polling'] });

let sessionId = null;
let connected = false;

// --- Socket events ---

socket.on('connect', () => {
    console.log('[App] Connected:', socket.id);
});

socket.on('session_id', ({ sessionId: sid }) => {
    sessionId = sid;
    console.log('[App] Session:', sessionId);
});

socket.on('status', ({ message }) => {
    setTerminalText(message);
});

socket.on('pairing_code', ({ code }) => {
    showPairingCode(code);
});

socket.on('connected', ({ message }) => {
    connected = true;
    showSuccess();
    showToast('CONNECTION_ESTABLISHED — Bot is now running!', 'success');
});

socket.on('logged_out', ({ message }) => {
    showToast(message || 'SESSION_TERMINATED — Please reconnect.', 'error');
    resetUI();
});

socket.on('error', ({ message }) => {
    showToast('ERR: ' + message, 'error');
    resetUI();
});

socket.on('reset_ui', () => {
    // Handled by success display
});

// --- Start Pairing ---

function startPairing() {
    const input = document.getElementById('phoneInput');
    const phone = input.value.replace(/\D/g, '');

    if (!phone || phone.length < 7) {
        showToast('ERR: Invalid phone number. Include country code.', 'error');
        input.focus();
        return;
    }

    const btn = document.getElementById('btnPair');
    btn.disabled = true;

    // Show loading state
    document.getElementById('pairIdle').classList.add('hidden');
    document.getElementById('pairResult').classList.add('hidden');
    document.getElementById('pairLoading').classList.remove('hidden');

    socket.emit('start_pairing', { phone });

    // Re-enable after 90s if no result
    setTimeout(() => { btn.disabled = false; }, 90000);
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('phoneInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') startPairing();
        });
    }
});

// --- Show Pairing Code ---

function showPairingCode(code) {
    document.getElementById('pairLoading').classList.add('hidden');
    document.getElementById('pairIdle').classList.add('hidden');
    document.getElementById('pairCode').textContent = code;
    document.getElementById('pairResult').classList.remove('hidden');
    document.getElementById('btnPair').disabled = false;
    showToast('PAIRING_CODE_READY — Enter it in WhatsApp!', 'success');
}

// --- Show Success ---

function showSuccess() {
    document.getElementById('mainCard').classList.add('hidden');
    document.getElementById('successCard').classList.remove('hidden');
}

// --- Reset UI ---

function resetUI() {
    connected = false;

    document.getElementById('pairIdle').classList.remove('hidden');
    document.getElementById('pairLoading').classList.add('hidden');
    document.getElementById('pairResult').classList.add('hidden');
    document.getElementById('pairCode').textContent = '----';
    document.getElementById('phoneInput').value = '';
    document.getElementById('btnPair').disabled = false;

    document.getElementById('mainCard').classList.remove('hidden');
    document.getElementById('successCard').classList.add('hidden');

    setTimeout(() => { window.location.reload(); }, 300);
}

// --- Toast ---

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast';
    if (type) toast.classList.add(type);
    toast.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
}

// --- Terminal text helper ---

function setTerminalText(msg) {
    const el = document.querySelector('.terminal-loader');
    if (el) el.textContent = msg;
}
