const required = [
  'GREEN_API_ID_INSTANCE',
  'GREEN_API_TOKEN',
  'OPENROUTER_API_KEY',
  'KNOWLEDGE_DOC_ID',
  'INVENTORY_SHEET_ID',
  'ORDERS_SHEET_ID',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`חסרים משתני סביבה: ${missing.join(', ')}`);
  console.error('העתיקו את .env.example ל-.env ומלאו אותו.');
  process.exit(1);
}

// An empty ALLOWED_SENDERS means "answer everyone" — that is the point of a
// customer-service bot. Fill it in to lock the bot to specific numbers while
// you develop or record a demo.
const allowedSenders = (process.env.ALLOWED_SENDERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const idInstance = process.env.GREEN_API_ID_INSTANCE;

export default Object.freeze({
  greenApi: {
    idInstance,
    token: process.env.GREEN_API_TOKEN,
    // Green API shards by the first four digits of the instance id (7103…, 7107…).
    // Hardcoding one shard breaks silently the moment the instance is recreated.
    baseUrl:
      process.env.GREEN_API_BASE_URL ||
      `https://${String(idInstance).slice(0, 4)}.api.greenapi.com`,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-5.6-terra',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  data: {
    knowledgeDocId: process.env.KNOWLEDGE_DOC_ID,
    inventorySheetId: process.env.INVENTORY_SHEET_ID,
    ordersSheetId: process.env.ORDERS_SHEET_ID,
    // Google serves these from cache; 60s is short enough that an inventory
    // edit shows up during a demo, long enough not to refetch on every message.
    cacheSeconds: parseInt(process.env.DATA_CACHE_SECONDS || '60', 10),
  },
  // Public base for the catalogue pages. Railway injects RAILWAY_PUBLIC_DOMAIN,
  // so this resolves itself on deploy and only needs setting when the site lives
  // somewhere else.
  siteBaseUrl:
    process.env.SITE_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : ''),
  // Number customers reach on WhatsApp, for the site's call-to-action links.
  shopWhatsapp: (process.env.SHOP_WHATSAPP || '').replace(/\D/g, ''),
  business: {
    name: process.env.BUSINESS_NAME || 'העסק',
    ownerName: process.env.OWNER_NAME || 'בעל העסק',
    ownerPhone: process.env.OWNER_PHONE || '',
    // Where notify_owner sends its alerts. Separate from OWNER_PHONE, which is
    // the display number quoted to customers and not necessarily on WhatsApp.
    ownerWhatsapp: (process.env.OWNER_WHATSAPP || '').replace(/\D/g, ''),
  },
  allowedSenders,
  memoryFile: process.env.MEMORY_FILE || './data/conversations.json',
  port: parseInt(process.env.PORT || '3000', 10),
});
