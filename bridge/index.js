/**
 * OpenClaw Bridge  v2.1
 * =====================
 * Fixes:
 *  - Telegram: removed Markdown parse_mode that caused send failures
 *  - Telegram: added deleteWebhook() call before polling to prevent conflict errors
 *  - Telegram: proper polling_error handler with reconnect
 *  - API key sent on every agent request
 *  - Per-user session isolation
 */

const express   = require('express');
const axios     = require('axios');
const NodeCache = require('node-cache');
const winston   = require('winston');
const QRCode    = require('qrcode');
const fs        = require('fs');
const path      = require('path');

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// ── Stats & Log Buffer ────────────────────────────────────────────────────────
const startTime = Date.now();
const stats = {
  messages: { whatsapp: 0, telegram: 0, api: 0 },
  errors:   { whatsapp: 0, telegram: 0, agent: 0 },
  clickup:  { created: 0, failed: 0 },
  sessions: new Set(),
};
// Atomic-safe increment — prevents read-modify-write races across async handlers
const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
const logBuffer = []; // last 200 lines
const MAX_LOG_LINES = 200;

function pushLog(level, message) {
  const entry = { ts: new Date().toISOString(), level, message };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
}

// Patch winston to also push to logBuffer
const origLog = logger.info.bind(logger);
const origWarn = logger.warn.bind(logger);
const origErr = logger.error.bind(logger);
logger.info  = (m) => { pushLog('INFO',  m); origLog(m); };
logger.warn  = (m) => { pushLog('WARN',  m); origWarn(m); };
logger.error = (m) => { pushLog('ERROR', m); origErr(m); };

// ── Config ────────────────────────────────────────────────────────────────────
const PORT              = process.env.PORT              || 3100;
const DOCS_AGENT_URL    = process.env.DOCS_AGENT_URL    || 'http://docs-agent:8100';
const GENERAL_AGENT_URL = process.env.GENERAL_AGENT_URL || 'http://general-agent:8200';
const AGENT_API_KEY     = process.env.AGENT_API_KEY     || 'cs-internal-agent-key';
if (!process.env.AGENT_API_KEY) logger.warn('AGENT_API_KEY is not set — using insecure default. Set it in .env before deployment.');
const ENABLE_WHATSAPP   = process.env.ENABLE_WHATSAPP   !== 'false';
const ENABLE_TELEGRAM   = process.env.ENABLE_TELEGRAM   !== 'false';
const ENABLE_SECOND_TELEGRAM = process.env.ENABLE_SECOND_TELEGRAM === 'true';
const SESSION_DIR       = process.env.SESSION_DIR || '/app/data/whatsapp-session';
const CONFIG_PATH       = process.env.CONFIG_PATH  || '/app/data/bridge_config.json';

// --- Global Config Load/Save ---
let config = {
  tgToken:          process.env.TELEGRAM_BOT_TOKEN        || '',  // Bot 1 — internal staff
  secondTgToken:    process.env.SECOND_TELEGRAM_BOT_TOKEN || '',  // Bot 2 — customer-facing
  internalChannelId: process.env.INTERNAL_CHANNEL_ID      || '',  // Bot 1 proactive push target
  cuToken: process.env.CLICKUP_API_KEY || '',
  cuTeam:  process.env.CLICKUP_TEAM_ID  || '',
  cuList:  process.env.CLICKUP_LIST_ID  || '',
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      config = { ...config, ...saved };
      logger.info('External config loaded.');
    }
  } catch (err) { logger.error('Failed to load config.json: ' + err.message); }
}

function saveConfig() {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    logger.info('External config saved.');
  } catch (err) { logger.error('Failed to save config.json: ' + err.message); }
}

loadConfig();

// ── Axios instance with API key always attached ───────────────────────────────
const agentHttp = axios.create({
  headers: { 'X-API-Key': AGENT_API_KEY, 'Content-Type': 'application/json' },
  timeout: 120000,   // 2 min — LLM on CPU can be slow
});

// ── Per-user agent preference ('docs' | 'general' | undefined = auto) ─────────
const prefCache = new NodeCache({ stdTTL: 3600 });

// ── Keywords for auto-routing ─────────────────────────────────────────────────
const DOC_KEYWORDS = [
  // English
  'document','file','pdf','form','contract','certificate','invoice',
  'report','policy','procedure','manual','guide','attachment','scan',
  'letter','application','permit','receipt','agreement',
  // Arabic
  'مستند','ملف','وثيقة','عقد','شهادة','فاتورة','تقرير',
  'نموذج','سياسة','دليل','إجراء','مرفق','مسح','خطاب',
  'طلب','تصريح','إيصال','اتفاقية',
];

function shouldUseDocs(text, sessionId) {
  const pref = prefCache.get(sessionId);
  if (pref === 'docs')    return true;
  if (pref === 'general') return false;
  const lower = text.toLowerCase();
  return DOC_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Query agent ───────────────────────────────────────────────────────────────
async function queryAgent(message, sessionId) {
  const useDocs   = shouldUseDocs(message, sessionId);
  const url       = useDocs ? `${DOCS_AGENT_URL}/ask` : `${GENERAL_AGENT_URL}/ask`;
  const agentName = useDocs ? 'Docs' : 'General';

  stats.sessions.add(sessionId);
  logger.info(`[${sessionId}] → ${agentName}: "${message.slice(0, 60)}"`);

  try {
    const { data } = await agentHttp.post(url, {
      question:   message,
      session_id: sessionId,
    });

    let answer = data.answer || 'Sorry, no response received.';
    if (useDocs && data.sources && data.sources.length > 0) {
      answer += `\n\nSource: ${data.sources.join(', ')}`;
    }
    return answer;

  } catch (err) {
    inc(stats.errors, 'agent');
    const status = err.response?.status;
    if (status === 429) {
      return 'Too many messages. Please wait a minute.\nرسائل كثيرة جداً. يرجى الانتظار دقيقة.';
    }
    if (status === 401) {
      logger.error('Agent rejected API key — check AGENT_API_KEY');
      return 'Configuration error. Please contact the administrator.';
    }
    logger.error(`Agent error [${sessionId}]: ${err.message}`);
    return 'An error occurred. Please try again.\nحدث خطأ. يرجى المحاولة مجدداً.';
  }
}

// ── Clear user history in both agents ─────────────────────────────────────────
async function clearUserHistory(sessionId) {
  prefCache.del(sessionId);
  await Promise.allSettled([
    agentHttp.delete(`${DOCS_AGENT_URL}/history/${encodeURIComponent(sessionId)}`),
    agentHttp.delete(`${GENERAL_AGENT_URL}/history/${encodeURIComponent(sessionId)}`),
  ]);
  logger.info(`Cleared history: ${sessionId}`);
}

function sanitizeText(str) {
  return String(str)
    .replace(/<[^>]*>/g, '')      // strip HTML tags
    .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
    .trim()
    .slice(0, 10000);             // hard cap — ClickUp description limit
}

// ── Escalation store (in-memory, last 50) — powers Bot 1 /pending ────────────
const MAX_ESCALATIONS = 50;
const escalationStore = []; // { sessionId, preview, clickupUrl, ts }

function storeEscalation(sessionId, preview, clickupUrl) {
  escalationStore.unshift({ sessionId, preview, clickupUrl, ts: new Date().toISOString() });
  if (escalationStore.length > MAX_ESCALATIONS) escalationStore.pop();
}

// ── Notify internal staff channel (Bot 1) ─────────────────────────────────────
async function notifyInternalChannel(text) {
  const channelId = config.internalChannelId;
  if (!channelId) return;
  if (!global.tgBot) { logger.warn('notifyInternalChannel: Bot 1 not ready'); return; }
  try {
    const parts = text.match(/.{1,4000}/gs) || [text];
    for (const part of parts) {
      await global.tgBot.sendMessage(channelId, part);
      if (parts.length > 1) await new Promise(r => setTimeout(r, 300));
    }
  } catch (err) {
    logger.error(`notifyInternalChannel failed: ${err.message}`);
  }
}

// ── Query agent for customer — docs first, falls back to general ──────────────
// Returns { answer, found, sources }
// found = true means docs agent had relevant sources — no escalation needed
async function queryAgentForCustomer(message, sessionId) {
  stats.sessions.add(sessionId);
  logger.info(`[${sessionId}] Customer query: "${message.slice(0, 60)}"`);

  // Step 1 — try docs agent
  try {
    const { data } = await agentHttp.post(`${DOCS_AGENT_URL}/ask`, {
      question:   message,
      session_id: sessionId,
    });
    const sources = data.sources || [];
    const answer  = data.answer  || '';

    if (sources.length > 0 && answer) {
      logger.info(`[${sessionId}] Docs agent resolved (${sources.length} sources).`);
      return { answer, found: true, sources };
    }
    // Docs agent had no relevant sources — fall through to general
    logger.info(`[${sessionId}] Docs agent: no sources. Trying general agent.`);
  } catch (err) {
    inc(stats.errors, 'agent');
    const status = err.response?.status;
    if (status === 429) return { answer: 'Too many messages. Please wait a moment.\nرسائل كثيرة. يرجى الانتظار.', found: false, sources: [] };
    if (status === 401) { logger.error('Agent rejected API key'); return { answer: 'Configuration error. Please contact support.', found: false, sources: [] }; }
    logger.error(`Docs agent error [${sessionId}]: ${err.message}`);
  }

  // Step 2 — general agent as best-effort fallback
  try {
    const { data } = await agentHttp.post(`${GENERAL_AGENT_URL}/ask`, {
      question:   message,
      session_id: sessionId,
    });
    const answer = data.answer || '';
    logger.info(`[${sessionId}] General agent responded (no sources — escalation needed).`);
    return { answer, found: false, sources: [] };
  } catch (err) {
    inc(stats.errors, 'agent');
    logger.error(`General agent error [${sessionId}]: ${err.message}`);
    return {
      answer: 'An error occurred. Please try again.\nحدث خطأ. يرجى المحاولة مجدداً.',
      found: false,
      sources: [],
    };
  }
}

// ── ClickUp Integration ───────────────────────────────────────────────────────
async function createClickUpTask(description, customerSession) {
  if (!config.cuToken || !config.cuList) {
    logger.warn('ClickUp not configured.');
    return null;
  }
  try {
    const url = `https://api.clickup.com/api/v2/list/${config.cuList}/task`;
    const res = await axios.post(url, {
      name: `Report from ${customerSession}`,
      description: sanitizeText(description),
      status: "to do",
      priority: 3,
      tags: ["ai-report", customerSession.startsWith('wa') ? "whatsapp" : "telegram"]
    }, {
      headers: { 'Authorization': config.cuToken }
    });
    inc(stats.clickup, 'created');
    logger.info(`ClickUp task created: ${res.data.url}`);
    return res.data;
  } catch (err) {
    inc(stats.clickup, 'failed');
    logger.error('ClickUp creation failed: ' + (err.response?.data?.text || err.message));
    return null;
  }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

let whatsappQR    = null;
let whatsappReady = false;

app.get('/health', (_, res) => res.json({
  status:   'ok',
  whatsapp: { enabled: ENABLE_WHATSAPP, ready: whatsappReady },
  telegram: { enabled: ENABLE_TELEGRAM, configured: !!config.tgToken && config.tgToken !== 'your-telegram-bot-token' },
}));

app.get('/qr', async (_, res) => {
  if (!ENABLE_WHATSAPP) return res.status(400).send('WhatsApp not enabled');
  if (whatsappReady)    return res.send('<h2 style="font-family:sans-serif;text-align:center;padding:40px">✅ WhatsApp connected!</h2>');
  if (!whatsappQR)      return res.send('<h2 style="font-family:sans-serif;text-align:center;padding:40px">⏳ QR not ready — refresh in 15 seconds</h2><script>setTimeout(()=>location.reload(),15000)</script>');
  try {
    const qr = await QRCode.toDataURL(whatsappQR);
    res.send(`<!DOCTYPE html><html><head><title>WhatsApp QR</title>
      <meta http-equiv="refresh" content="30">
      <style>body{display:flex;flex-direction:column;align-items:center;padding:40px;font-family:sans-serif}</style>
      </head><body>
      <h2>Scan with WhatsApp</h2>
      <p>Open WhatsApp → Linked Devices → Link a Device</p>
      <img src="${qr}" style="border:4px solid #25D366;border-radius:12px"/>
      <p style="color:#999;font-size:12px">Auto-refreshes every 30s</p>
      </body></html>`);
  } catch { res.status(500).send('QR generation failed'); }
});

app.post('/send', async (req, res) => {
  const { message, session_id } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  inc(stats.messages, 'api');
  const response = await queryAgent(message, session_id || 'api-test');
  res.json({ response });
});

app.get('/stats', (_, res) => {
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    uptime_seconds: uptimeSec,
    uptime_human: formatUptime(uptimeSec),
    messages: { ...stats.messages, total: stats.messages.whatsapp + stats.messages.telegram + stats.messages.api },
    errors:   stats.errors,
    clickup:  stats.clickup,
    active_sessions: stats.sessions.size,
    whatsapp: { enabled: ENABLE_WHATSAPP, ready: whatsappReady },
    telegram: { enabled: ENABLE_TELEGRAM, configured: !!(config.tgToken && config.tgToken !== 'your-telegram-bot-token') },
  });
});

app.get('/api/logs', (_, res) => {
  res.json({ logs: logBuffer.slice().reverse() }); // newest first
});

app.post('/api/commands', async (req, res) => {
  const { command } = req.body;
  logger.info(`Command received: ${command}`);

  if (command === 'restart-telegram') {
    try {
      await startTelegram();
      return res.json({ success: true, message: 'Telegram bot restarted.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  if (command === 'restart-whatsapp') {
    try {
      await startWhatsApp();
      return res.json({ success: true, message: 'WhatsApp client restarting…' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  if (command === 'clear-all-sessions') {
    const sessionIds = Array.from(stats.sessions);
    await Promise.allSettled(sessionIds.map(id => clearUserHistory(id)));
    stats.sessions.clear();
    return res.json({ success: true, message: `Cleared ${sessionIds.length} sessions.` });
  }

  if (command === 'stats') {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    return res.json({
      success: true,
      message: [
        `Uptime: ${formatUptime(uptimeSec)}`,
        `WA messages: ${stats.messages.whatsapp}  |  TG messages: ${stats.messages.telegram}`,
        `Active sessions: ${stats.sessions.size}`,
        `Agent errors: ${stats.errors.agent}`,
        `ClickUp created: ${stats.clickup.created}  failed: ${stats.clickup.failed}`,
      ].join('\n'),
    });
  }

  return res.status(400).json({ success: false, message: `Unknown command: ${command}` });
});

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

app.post('/api/config', (req, res) => {
  const { tgToken, secondTgToken, internalChannelId, cuToken, cuTeam, cuList } = req.body;
  if (tgToken           !== undefined) config.tgToken           = tgToken;
  if (secondTgToken     !== undefined) config.secondTgToken     = secondTgToken;
  if (internalChannelId !== undefined) config.internalChannelId = internalChannelId;
  if (cuToken           !== undefined) config.cuToken           = cuToken;
  if (cuTeam            !== undefined) config.cuTeam            = cuTeam;
  if (cuList            !== undefined) config.cuList            = cuList;
  saveConfig();
  
  // Trigger hot-reload of bots
  if (tgToken !== undefined) {
    logger.info('Telegram token changed, restarting bot...');
    startTelegram().catch(err => logger.error(`Telegram restart failed: ${err.message}`));
  }
  res.json({ success: true, config });
});

app.post('/api/whatsapp/reset', async (req, res) => {
  whatsappReady = false;
  whatsappQR = null;
  try {
    // Properly destroy existing client to release locks/puppeteer
    if (global.waClient) {
      try { await global.waClient.destroy(); } catch(e){}
    }
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    logger.info('WhatsApp session cleared. Rebooting client...');
    startWhatsApp(); // Re-init
    res.json({ success: true, message: 'WhatsApp session reset initiated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp ──────────────────────────────────────────────────────────────────
async function startWhatsApp() {
  if (!ENABLE_WHATSAPP) { logger.info('WhatsApp disabled.'); return; }
  let Client, LocalAuth;
  try { ({ Client, LocalAuth } = require('whatsapp-web.js')); }
  catch { logger.warn('whatsapp-web.js not found — WhatsApp disabled.'); return; }
  
  // If there's an existing client, try to destroy it first
  if (global.waClient) {
    try { await global.waClient.destroy(); } catch(e){}
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
    },
  });

  client.on('qr',    qr => { whatsappQR = qr; logger.info('WhatsApp QR ready → /qr'); try { require('qrcode-terminal').generate(qr, { small: true }); } catch(_){} });
  client.on('ready', ()  => { whatsappReady = true; whatsappQR = null; logger.info('WhatsApp ready'); });
  client.on('disconnected', r => {
    whatsappReady = false;
    logger.warn(`WhatsApp disconnected: ${r}. Reconnecting...`);
    let attempt = 0;
    const retry = () => {
      attempt++;
      const delay = Math.min(1000 * 2 ** attempt, 60000); // 2s, 4s, 8s … cap 60s
      logger.info(`WhatsApp reconnect attempt ${attempt} in ${delay / 1000}s...`);
      setTimeout(() => startWhatsApp(), delay);
    };
    retry();
  });

  client.on('message', async msg => {
    if (msg.isGroupMsg || msg.type !== 'chat') return;
    const body      = (msg.body || '').trim();
    if (!body) return;
    inc(stats.messages, 'whatsapp');
    const sessionId = `wa_${msg.from}`;
    const lower     = body.toLowerCase();

    if (['/docs','/مستند'].includes(lower))    { prefCache.set(sessionId,'docs');    return msg.reply('Switched to Document Agent.\nتم التبديل إلى وكيل المستندات.'); }
    if (['/general','/عام'].includes(lower))   { prefCache.set(sessionId,'general'); return msg.reply('Switched to General Agent.\nتم التبديل إلى الوكيل العام.'); }
    if (['/auto','/تلقائي'].includes(lower))   { prefCache.del(sessionId);           return msg.reply('Auto-routing enabled.\nتم تفعيل التوجيه التلقائي.'); }
    if (['/clear','/مسح'].includes(lower))     { await clearUserHistory(sessionId);  return msg.reply('History cleared.\nتم مسح المحادثة.'); }
    if (['/help','/مساعدة'].includes(lower))   {
      return msg.reply(
        'Commands:\n/docs - Document Agent\n/general - General Agent\n/auto - Auto-route\n/clear - Clear history\n/report [text] - File ClickUp issue\n\n' +
        'الأوامر:\n/docs - وكيل المستندات\n/general - الوكيل العام\n/auto - تلقائي\n/clear - مسح\n/report [نص] - إبلاغ عن مشكلة'
      );
    }

    if (lower.startsWith('/report ') || lower.startsWith('/إبلاغ ')) {
      const desc = body.split(' ').slice(1).join(' ');
      if (!desc) return msg.reply('Please provide report details.\nيرجى تقديم تفاصيل البلاغ.');
      const task = await createClickUpTask(desc, sessionId);
      return msg.reply(task ? `Task created: ${task.url}\nتم إنشاء المهمة: ${task.url}` : 'Failed to create task.\nفشل إنشاء المهمة.');
    }

    const chat = await msg.getChat();
    await chat.sendStateTyping();
    const response = await queryAgent(body, sessionId);
    await msg.reply(response);
  });

  global.waClient = client;
  await client.initialize();
}

// ── Bot 1 — Internal Staff Telegram Bot ──────────────────────────────────────
// Purpose : proactive push to INTERNAL_CHANNEL_ID on customer events
//           + staff commands (/stats, /pending) from within that channel
// Token   : config.tgToken (TELEGRAM_BOT_TOKEN)
// Channel : config.internalChannelId (INTERNAL_CHANNEL_ID)
async function startTelegram() {
  if (!ENABLE_TELEGRAM) { logger.info('Bot 1 (staff): disabled.'); return; }

  const token = config.tgToken;
  if (!token) { logger.info('Bot 1 (staff): no token set — skipping.'); return; }

  if (global.tgBot) {
    try { await global.tgBot.stopPolling(); } catch(e){}
  }

  let TelegramBot;
  try { TelegramBot = require('node-telegram-bot-api'); }
  catch { logger.warn('node-telegram-bot-api not installed.'); return; }

  try {
    const cleanupBot = new TelegramBot(token, { polling: false });
    await cleanupBot.deleteWebhook();
  } catch (e) { logger.warn(`Bot 1 webhook clear failed (non-fatal): ${e.message}`); }

  const bot = new TelegramBot(token, {
    polling: { interval: 1000, autoStart: true, params: { timeout: 10 } },
  });

  global.tgBot = bot;
  logger.info('Bot 1 (staff) started.');

  async function send(chatId, text) {
    try {
      const parts = text.match(/.{1,4000}/gs) || [text];
      for (const part of parts) {
        await bot.sendMessage(chatId, part);
        if (parts.length > 1) await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) { logger.error(`Bot 1 send failed [${chatId}]: ${err.message}`); }
  }

  // ── /stats — system overview ─────────────────────────────────────────────────
  bot.onText(/\/stats/, msg => {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    send(msg.chat.id, [
      '📊 System Stats',
      `⏱  Uptime: ${formatUptime(uptimeSec)}`,
      `💬 Messages — WA: ${stats.messages.whatsapp}  TG: ${stats.messages.telegram}  API: ${stats.messages.api}`,
      `👥 Active sessions: ${stats.sessions.size}`,
      `❌ Agent errors: ${stats.errors.agent}`,
      `📋 ClickUp — created: ${stats.clickup.created}  failed: ${stats.clickup.failed}`,
      `📡 WhatsApp: ${whatsappReady ? '✅ connected' : '⚠️ disconnected'}`,
      `🤖 Bot 2: ${global.tgBot2 ? '✅ running' : '⚠️ not running'}`,
    ].join('\n'));
  });

  // ── /pending — last escalations waiting for human resolution ────────────────
  bot.onText(/\/pending/, msg => {
    if (escalationStore.length === 0) {
      return send(msg.chat.id, '✅ No pending escalations.');
    }
    const lines = ['🔴 Pending Escalations (latest first):\n'];
    escalationStore.slice(0, 10).forEach((e, i) => {
      const time = new Date(e.ts).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      lines.push(`${i + 1}. [${time}] ${e.sessionId}\n   "${e.preview}"\n   ${e.clickupUrl || 'No ClickUp task'}\n`);
    });
    send(msg.chat.id, lines.join('\n'));
  });

  // ── /help ────────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, msg => {
    send(msg.chat.id,
      '🤖 Staff Bot Commands:\n' +
      '/stats   — System statistics\n' +
      '/pending — Recent customer escalations\n' +
      '/help    — This message'
    );
  });

  // ── Ignore all non-command messages (this is a staff-only bot) ───────────────
  bot.on('message', msg => {
    if (!msg.text || msg.text.startsWith('/')) return;
    // Only respond in the configured internal channel, silently ignore elsewhere
    if (String(msg.chat.id) === String(config.internalChannelId)) return;
    send(msg.chat.id, 'This is an internal staff monitoring bot. Use /help for available commands.');
  });

  bot.on('polling_error', err => {
    const code = err.response?.statusCode || err.code;
    logger.error(`Bot 1 polling error [${code}]: ${err.message}`);
    if (code === 409) {
      bot.stopPolling()
        .then(() => bot.deleteWebhook())
        .then(() => setTimeout(() => bot.startPolling(), 3000))
        .catch(e => logger.error(`Bot 1 restart failed: ${e.message}`));
    }
  });

  bot.on('error', err => logger.error(`Bot 1 error: ${err.message}`));
}

// ── Bot 2 — Customer-Facing Telegram Bot ─────────────────────────────────────
// Purpose : customer self-service via AI; auto-escalates to ClickUp + notifies
//           internal staff (Bot 1) when the AI cannot resolve the issue.
// Token   : config.secondTgToken (SECOND_TELEGRAM_BOT_TOKEN)
async function startSecondTelegram() {
  if (!ENABLE_SECOND_TELEGRAM) { logger.info('Bot 2 (customer): disabled.'); return; }

  const token = config.secondTgToken;
  if (!token) {
    logger.info('Bot 2 (customer): no token set — skipping. Set SECOND_TELEGRAM_BOT_TOKEN to enable.');
    return;
  }

  if (global.tgBot2) {
    try { await global.tgBot2.stopPolling(); } catch(e){}
  }

  let TelegramBot;
  try { TelegramBot = require('node-telegram-bot-api'); }
  catch { logger.warn('node-telegram-bot-api not installed.'); return; }

  try {
    const cleanupBot = new TelegramBot(token, { polling: false });
    await cleanupBot.deleteWebhook();
  } catch (e) { logger.warn(`Bot 2 webhook clear failed (non-fatal): ${e.message}`); }

  const bot = new TelegramBot(token, {
    polling: { interval: 1000, autoStart: true, params: { timeout: 10 } },
  });

  global.tgBot2 = bot;
  logger.info('Bot 2 (customer) started.');

  // Per-customer in-flight guard — prevents duplicate requests while AI is thinking
  const inFlight = new Set();

  async function send(chatId, text) {
    try {
      const parts = text.match(/.{1,4000}/gs) || [text];
      for (const part of parts) {
        await bot.sendMessage(chatId, part);
        if (parts.length > 1) await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      logger.error(`Bot 2 send failed [${chatId}]: ${err.message}`);
    }
  }

  // ── /start ───────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, msg => {
    send(msg.chat.id,
      'Welcome! 👋 How can I help you today?\n' +
      'I\'ll do my best to answer your question. If I can\'t resolve it, I\'ll automatically escalate it to our support team.\n\n' +
      'مرحباً! 👋 كيف يمكنني مساعدتك اليوم؟\n' +
      'سأبذل قصارى جهدي للإجابة على سؤالك. إذا لم أتمكن من حله، سأقوم بتصعيده تلقائياً إلى فريق الدعم.'
    );
  });

  // ── /help ────────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, msg => {
    send(msg.chat.id,
      'Available commands:\n' +
      '/start — Welcome message\n' +
      '/clear — Clear your conversation history\n' +
      '/help  — This message\n\n' +
      'الأوامر المتاحة:\n' +
      '/start — رسالة الترحيب\n' +
      '/clear — مسح سجل المحادثة\n' +
      '/help  — هذه الرسالة\n\n' +
      'Just type your question and I\'ll answer it!\n' +
      'فقط اكتب سؤالك وسأجيب عليه!'
    );
  });

  // ── /clear ───────────────────────────────────────────────────────────────────
  bot.onText(/\/clear/, async msg => {
    const sessionId = `tg2_${msg.chat.id}`;
    await clearUserHistory(sessionId);
    send(msg.chat.id,
      'Your conversation history has been cleared. ✅\n' +
      'تم مسح سجل محادثتك. ✅'
    );
  });

  // ── Message handler ──────────────────────────────────────────────────────────
  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId    = msg.chat.id;
    const sessionId = `tg2_${chatId}`;
    const text      = msg.text.trim();

    // Prevent stacking requests while AI is processing
    if (inFlight.has(chatId)) {
      return send(chatId,
        'Please wait, I\'m still processing your previous message...\n' +
        'يرجى الانتظار، لا أزال أعالج رسالتك السابقة...'
      );
    }

    inFlight.add(chatId);
    inc(stats.messages, 'telegram');
    logger.info(`[Bot2:${chatId}] "${text.slice(0, 60)}"`);

    try {
      await bot.sendChatAction(chatId, 'typing');
    } catch (_) {}

    const { answer, found, sources } = await queryAgentForCustomer(text, sessionId);

    if (found) {
      // ── Resolved by docs agent ───────────────────────────────────────────────
      let reply = answer;
      if (sources && sources.length > 0) {
        reply += `\n\nSource: ${sources.join(', ')}`;
      }
      await send(chatId, reply);

      // Low-key log to internal channel (no escalation — just activity)
      notifyInternalChannel(
        `ℹ️ [Bot 2] Query resolved\n` +
        `Session: ${sessionId}\n` +
        `Preview: "${text.slice(0, 80)}"`
      ).catch(() => {});

    } else {
      // ── Not resolved — send best-effort answer + escalate ────────────────────
      if (answer) {
        await send(chatId, answer);
      }

      await send(chatId,
        '\n\nYour question has been escalated to our support team. A staff member will follow up with you shortly. 🔔\n\n' +
        'تم تصعيد سؤالك إلى فريق الدعم. سيتواصل معك أحد أعضاء الفريق قريباً. 🔔'
      );

      // Create ClickUp task
      const task = await createClickUpTask(
        `Customer message (Telegram):\n\n${text}\n\nAI answer provided:\n${answer || '(none)'}`,
        sessionId
      );

      const clickupUrl = task?.url || null;

      // Store in escalation store for /pending command
      storeEscalation(sessionId, text.slice(0, 120), clickupUrl);

      // Notify internal staff channel
      const firstName = msg.from?.first_name || 'Customer';
      const username  = msg.from?.username ? `@${msg.from.username}` : '';
      await notifyInternalChannel(
        `🔴 New Escalation — Bot 2\n` +
        `Customer: ${firstName} ${username} (session: ${sessionId})\n` +
        `Message: "${text.slice(0, 200)}"\n` +
        (clickupUrl ? `ClickUp: ${clickupUrl}` : '⚠️  ClickUp task creation failed')
      );
    }

    inFlight.delete(chatId);
  });

  bot.on('polling_error', err => {
    const code = err.response?.statusCode || err.code;
    logger.error(`Bot 2 polling error [${code}]: ${err.message}`);
    if (code === 409) {
      bot.stopPolling()
        .then(() => bot.deleteWebhook())
        .then(() => setTimeout(() => bot.startPolling(), 3000))
        .catch(e => logger.error(`Bot 2 restart failed: ${e.message}`));
    }
  });

  bot.on('error', err => logger.error(`Bot 2 error: ${err.message}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  app.listen(PORT, () => {
    logger.info(`OpenClaw on :${PORT}`);
    logger.info(`  QR:     http://localhost:${PORT}/qr`);
    logger.info(`  Health: http://localhost:${PORT}/health`);
  });

  await new Promise(r => setTimeout(r, 5000));   // wait for agents to start
  await Promise.allSettled([startWhatsApp(), startTelegram(), startSecondTelegram()]);
}

main().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
