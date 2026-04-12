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

// ── Config ────────────────────────────────────────────────────────────────────
const PORT              = process.env.PORT              || 3100;
const DOCS_AGENT_URL    = process.env.DOCS_AGENT_URL    || 'http://docs-agent:8100';
const GENERAL_AGENT_URL = process.env.GENERAL_AGENT_URL || 'http://general-agent:8200';
const AGENT_API_KEY     = process.env.AGENT_API_KEY     || 'cs-internal-agent-key';
const ENABLE_WHATSAPP   = process.env.ENABLE_WHATSAPP   !== 'false';
const ENABLE_TELEGRAM   = process.env.ENABLE_TELEGRAM   !== 'false';
const ENABLE_SECOND_TELEGRAM = process.env.ENABLE_SECOND_TELEGRAM === 'true';
const SESSION_DIR       = process.env.SESSION_DIR || '/app/data/whatsapp-session';
const CONFIG_PATH       = process.env.CONFIG_PATH  || '/app/data/openclaw_config.json';

// --- Global Config Load/Save ---
let config = {
  tgToken: process.env.TELEGRAM_BOT_TOKEN || '',
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
      description: description,
      status: "to do",
      priority: 3,
      tags: ["ai-report", customerSession.startsWith('wa') ? "whatsapp" : "telegram"]
    }, {
      headers: { 'Authorization': config.cuToken }
    });
    logger.info(`ClickUp task created: ${res.data.url}`);
    return res.data;
  } catch (err) {
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
  telegram: { enabled: ENABLE_TELEGRAM, configured: !!TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'your-telegram-bot-token' },
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
  const response = await queryAgent(message, session_id || 'api-test');
  res.json({ response });
});

app.post('/api/config', (req, res) => {
  const { tgToken, cuToken, cuTeam, cuList } = req.body;
  if (tgToken !== undefined) config.tgToken = tgToken;
  if (cuToken !== undefined) config.cuToken = cuToken;
  if (cuTeam  !== undefined) config.cuTeam  = cuTeam;
  if (cuList  !== undefined) config.cuList  = cuList;
  saveConfig();
  
  // Trigger hot-reload of bots
  if (tgToken !== undefined) {
    logger.info('Telegram token changed, restarting bot...');
    startTelegram(); 
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

  client.on('qr',          qr  => { whatsappQR = qr; logger.info('WhatsApp QR ready → /qr'); try { require('qrcode-terminal').generate(qr, { small: true }); } catch(_){} });
  client.on('ready',       ()  => { whatsappReady = true; whatsappQR = null; logger.info('WhatsApp ready'); });
  client.on('disconnected', r  => { whatsappReady = false; logger.warn(`WhatsApp disconnected: ${r}`); });

  client.on('message', async msg => {
    if (msg.isGroupMsg || msg.type !== 'chat') return;
    const body      = (msg.body || '').trim();
    if (!body) return;
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

// ── Telegram ──────────────────────────────────────────────────────────────────
async function startTelegram() {
  if (!ENABLE_TELEGRAM) { logger.info('Telegram disabled.'); return; }

  const token = config.tgToken;
  if (!token || token === 'your-telegram-bot-token') {
    logger.info('Telegram: no token set — skipping.');
    return;
  }

  // If there's an existing bot, stop it
  if (global.tgBot) {
    try { await global.tgBot.stopPolling(); } catch(e){}
  }

  let TelegramBot;
  try { TelegramBot = require('node-telegram-bot-api'); }
  catch { logger.warn('node-telegram-bot-api not installed.'); return; }

  // IMPORTANT: delete any existing webhook before starting polling
  // This prevents the "409 Conflict" error when a webhook was previously set
  try {
    const cleanupBot = new TelegramBot(token, { polling: false });
    await cleanupBot.deleteWebhook();
    logger.info('Telegram: webhook cleared.');
  } catch (e) {
    logger.warn(`Telegram webhook clear failed (non-fatal): ${e.message}`);
  }

  const bot = new TelegramBot(token, {
    polling: {
      interval: 1000,       // poll every 1 second
      autoStart: true,
      params: { timeout: 10 },
    }
  });

  global.tgBot = bot;
  logger.info('Telegram bot started (polling)');

  // ── Safe send helper — plain text only, no Markdown ─────────────────────────
  async function send(chatId, text) {
    try {
      // Telegram max message length = 4096 chars
      if (text.length <= 4000) {
        await bot.sendMessage(chatId, text);
      } else {
        const parts = text.match(/.{1,4000}/gs) || [text];
        for (const part of parts) {
          await bot.sendMessage(chatId, part);
          await new Promise(r => setTimeout(r, 300)); // small delay between parts
        }
      }
    } catch (err) {
      logger.error(`Telegram send failed [${chatId}]: ${err.message}`);
    }
  }

  // ── Commands ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, msg => {
    const name = msg.from?.first_name || 'there';
    send(msg.chat.id,
      `Hello ${name}! I am your AI customer service assistant.\n` +
      `مرحبا ${name}! انا مساعدك الذكي لخدمة العملاء.\n\n` +
      `Send any question in Arabic or English.\n` +
      `ارسل اي سؤال بالعربي او الانجليزي.\n\n` +
      `Type /help for commands.`
    );
  });

  bot.onText(/\/help/, msg => {
    send(msg.chat.id,
      'Commands:\n' +
      '/docs    - Force Document Agent\n' +
      '/general - Force General Agent\n' +
      '/auto    - Auto-route (default)\n' +
      '/clear   - Clear your history\n' +
      '/report  - File ClickUp issue\n' +
      '/start   - Welcome message\n\n' +
      'الاوامر:\n' +
      '/docs    - وكيل المستندات\n' +
      '/general - الوكيل العام\n' +
      '/auto    - توجيه تلقائي\n' +
      '/clear   - مسح المحادثة\n' +
      '/report  - إبلاغ عن مشكلة'
    );
  });

  bot.onText(/\/report (.+)/, async (msg, match) => {
    const desc = match[1];
    const task = await createClickUpTask(desc, `tg_${msg.chat.id}`);
    send(msg.chat.id, task ? `Task created: ${task.url}` : 'Failed to create task.');
  });

  bot.onText(/\/docs/, msg => {
    const sid = `tg_${msg.chat.id}`;
    prefCache.set(sid, 'docs');
    send(msg.chat.id, 'Switched to Document Agent.\nتم التبديل الى وكيل المستندات.');
  });

  bot.onText(/\/general/, msg => {
    const sid = `tg_${msg.chat.id}`;
    prefCache.set(sid, 'general');
    send(msg.chat.id, 'Switched to General Agent.\nتم التبديل الى الوكيل العام.');
  });

  bot.onText(/\/auto/, msg => {
    const sid = `tg_${msg.chat.id}`;
    prefCache.del(sid);
    send(msg.chat.id, 'Auto-routing enabled.\nتم تفعيل التوجيه التلقائي.');
  });

  bot.onText(/\/clear/, async msg => {
    const sid = `tg_${msg.chat.id}`;
    await clearUserHistory(sid);
    send(msg.chat.id, 'Conversation cleared.\nتم مسح المحادثة.');
  });

  // ── All other messages ────────────────────────────────────────────────────────
  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const sessionId = `tg_${msg.chat.id}`;
    logger.info(`[TG:${msg.chat.id}] "${msg.text.slice(0, 60)}"`);

    try { await bot.sendChatAction(msg.chat.id, 'typing'); } catch (_) {}

    const response = await queryAgent(msg.text.trim(), sessionId);
    await send(msg.chat.id, response);
  });

  // ── Polling error handler with reconnect ──────────────────────────────────────
  bot.on('polling_error', err => {
    const code = err.response?.statusCode || err.code;
    logger.error(`Telegram polling error [${code}]: ${err.message}`);

    // 409 = webhook conflict — try to clear and restart
    if (code === 409) {
      logger.warn('Webhook conflict detected. Attempting to clear webhook and restart polling...');
      bot.stopPolling().then(() => {
        return bot.deleteWebhook();
      }).then(() => {
        setTimeout(() => bot.startPolling(), 3000);
      }).catch(e => logger.error(`Restart failed: ${e.message}`));
    }
  });

  bot.on('error', err => {
    logger.error(`Telegram error: ${err.message}`);
  });
}

// ── Second Telegram (Issues Handler) ──────────────────────────────────────────
async function startSecondTelegram() {
  if (!ENABLE_SECOND_TELEGRAM) { logger.info('Second Telegram disabled.'); return; }

  const token = SECOND_TELEGRAM_TOKEN;
  if (!token || token === 'your-second-bot-token-here') {
    logger.info('Second Telegram: no token set — skipping. Set SECOND_TELEGRAM_BOT_TOKEN to enable.');
    return;
  }

  let TelegramBot;
  try { TelegramBot = require('node-telegram-bot-api'); }
  catch { logger.warn('node-telegram-bot-api not installed.'); return; }

  try {
    const cleanupBot = new TelegramBot(token, { polling: false });
    await cleanupBot.deleteWebhook();
    logger.info('Second Telegram: webhook cleared.');
  } catch (e) {
    logger.warn(`Second Telegram webhook clear failed (non-fatal): ${e.message}`);
  }

  const bot = new TelegramBot(token, {
    polling: {
      interval: 1000,
      autoStart: true,
      params: { timeout: 10 },
    }
  });

  logger.info('Second Telegram bot started (polling)');

  async function send(chatId, text) {
    try {
      if (text.length <= 4000) {
        await bot.sendMessage(chatId, text);
      } else {
        const parts = text.match(/.{1,4000}/gs) || [text];
        for (const part of parts) {
          await bot.sendMessage(chatId, part);
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (err) {
      logger.error(`Second Telegram send failed [${chatId}]: ${err.message}`);
    }
  }

  bot.onText(/\/start/, msg => {
    send(msg.chat.id, 'Welcome to the specialized support channel.');
  });

  bot.onText(/\/help/, msg => {
    send(msg.chat.id, 'Type your issue and we will route it properly.');
  });

  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const sessionId = `tg2_${msg.chat.id}`;
    logger.info(`[TG2:${msg.chat.id}] "${msg.text.slice(0, 60)}"`);

    try { await bot.sendChatAction(msg.chat.id, 'typing'); } catch (_) {}
    
    // Auto route logic or specialized logic
    const response = await queryAgent(msg.text.trim(), sessionId);
    await send(msg.chat.id, response);
  });

  bot.on('polling_error', err => {
    const code = err.response?.statusCode || err.code;
    logger.error(`Second Telegram polling error [${code}]: ${err.message}`);
    if (code === 409) {
      bot.stopPolling().then(() => bot.deleteWebhook()).then(() => setTimeout(() => bot.startPolling(), 3000));
    }
  });

  bot.on('error', err => {
    logger.error(`Second Telegram error: ${err.message}`);
  });
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
