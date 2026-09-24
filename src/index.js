import http from 'node:http';
import config from './config.js';
import { answer } from './agent.js';
import { getHistory, remember, forget } from './memory.js';
import { sendMessage, extractText, getStateInstance } from './green-api.js';
import { homePage, catalogPage, categoryPage, productPage, infoPage } from './site.js';

const seen = new Set(); // Green API redelivers on timeout; dedupe by message id.

function isAllowed(senderPhone) {
  if (!config.allowedSenders.length) return true; // open to all customers
  return config.allowedSenders.some(
    (s) => s.replace(/\D/g, '') === senderPhone.replace(/\D/g, '')
  );
}

async function handleMessage(body) {
  const { senderData, messageData, idMessage } = body;
  if (!senderData || !messageData) return;

  // Groups are ignored: a shop bot answering inside group chats is a fast way
  // to get the number reported and blocked.
  const chatId = senderData.chatId;
  if (!chatId?.endsWith('@c.us')) return;

  if (seen.has(idMessage)) return;
  seen.add(idMessage);
  if (seen.size > 1000) seen.clear();

  const senderPhone = chatId.replace('@c.us', '');
  if (!isAllowed(senderPhone)) {
    console.log(`[skip] מספר לא מורשה: ${senderPhone}`);
    return;
  }

  const text = extractText(messageData);
  if (!text?.trim()) return;

  console.log(`[in ] ${senderPhone}: ${text}`);

  if (text.trim() === '/reset') {
    await forget(chatId);
    await sendMessage(chatId, 'השיחה אופסה.');
    return;
  }

  const history = await getHistory(chatId);
  const { reply, afterReply } = await answer({
    text: text.trim(),
    senderPhone,
    history,
  });

  if (!reply) return;
  await sendMessage(chatId, reply);
  await remember(chatId, text.trim(), reply);
  console.log(`[out] ${senderPhone}: ${reply}`);
  // Owner notifications go out only once the customer has their answer.
  await afterReply();
}

const html = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    homePage()
      .then((body) => html(res, 200, body))
      .catch((err) => html(res, 500, `<h1>שגיאה בטעינת הקטלוג</h1><p>${err.message}</p>`));
    return;
  }

  if (req.method === 'GET') {
    const path = req.url.split('?')[0];
    const routes = [
      [/^\/catalog$/, () => catalogPage()],
      [/^\/info$/, () => infoPage()],
      [/^\/c\/(.+)$/, (m) => categoryPage(decodeURIComponent(m[1]))],
      [/^\/p\/([\w-]+)$/, (m) => productPage(m[1])],
    ];
    for (const [re, handler] of routes) {
      const m = path.match(re);
      if (!m) continue;
      handler(m)
        .then((body) =>
          body
            ? html(res, 200, body)
            : html(res, 404, '<h1>העמוד לא נמצא</h1><a href="/">חזרה לאתר</a>')
        )
        .catch((err) => html(res, 500, `<h1>שגיאה</h1><p>${err.message}</p>`));
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', model: config.openrouter.model }));
    return;
  }

  if (req.method !== 'POST' || !req.url.startsWith('/webhook')) {
    res.writeHead(404).end();
    return;
  }

  let raw = '';
  req.on('data', (c) => {
    raw += c;
  });
  req.on('end', () => {
    // Answer Green API before doing any work. It retries anything slow, and a
    // retry means the customer gets the same reply twice.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return;
    }
    if (body.typeWebhook !== 'incomingMessageReceived') return;

    handleMessage(body).catch((err) => console.error('[error]', err.message));
  });
});

server.listen(config.port, async () => {
  console.log(`הסוכן עלה על פורט ${config.port} · מודל ${config.openrouter.model}`);
  try {
    const { stateInstance } = await getStateInstance();
    console.log(`מצב Green API: ${stateInstance}`);
    if (stateInstance !== 'authorized') {
      console.warn('האינסטנס לא מחובר. סרקו QR בקונסולה של Green API, או לחצו אתחול.');
    }
  } catch (err) {
    console.error('בדיקת Green API נכשלה:', err.message);
  }
});
