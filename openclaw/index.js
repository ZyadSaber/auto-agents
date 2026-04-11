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
const TELEGRAM_TOKEN    = process.env.TELEGRAM_BOT_TOKEN || '';
const SESSION_DIR       = '/app/data/whatsapp-session';

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

// ── WhatsApp ──────────────────────────────────────────────────────────────────
async function startWhatsApp() {
  if (!ENABLE_WHATSAPP) { logger.info('WhatsApp disabled.'); return; }
  let Client, LocalAuth;
  try { ({ Client, LocalAuth } = require('whatsapp-web.js')); }
  catch { logger.warn('whatsapp-web.js not found — WhatsApp disabled.'); return; }

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
        'Commands:\n/docs - Document Agent\n/general - General Agent\n/auto - Auto-route\n/clear - Clear history\n\n' +
        'الأوامر:\n/docs - وكيل المستندات\n/general - الوكيل العام\n/auto - تلقائي\n/clear - مسح'
      );
    }

    const chat = await msg.getChat();
    await chat.sendStateTyping();
    const response = await queryAgent(body, sessionId);
    await msg.reply(response);
  });

  await client.initialize();
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function startTelegram() {
  if (!ENABLE_TELEGRAM) { logger.info('Telegram disabled.'); return; }

  const token = TELEGRAM_TOKEN;
  if (!token || token === 'your-telegram-bot-token') {
    logger.info('Telegram: no token set — skipping. Set TELEGRAM_BOT_TOKEN to enable.');
    return;
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
      '/start   - Welcome message\n\n' +
      'الاوامر:\n' +
      '/docs    - وكيل المستندات\n' +
      '/general - الوكيل العام\n' +
      '/auto    - توجيه تلقائي\n' +
      '/clear   - مسح المحادثة'
    );
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  app.listen(PORT, () => {
    logger.info(`OpenClaw on :${PORT}`);
    logger.info(`  QR:     http://localhost:${PORT}/qr`);
    logger.info(`  Health: http://localhost:${PORT}/health`);
  });

  await new Promise(r => setTimeout(r, 5000));   // wait for agents to start
  await Promise.allSettled([startWhatsApp(), startTelegram()]);
}

main().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
