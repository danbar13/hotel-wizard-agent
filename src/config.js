import fs from 'node:fs';

const hasLocalKnowledge = fs.existsSync('./data/knowledge.txt') || fs.existsSync('./data/knowledge.md');
const hasLocalInventory = fs.existsSync('./data/inventory.csv');
const hasLocalOrders = fs.existsSync('./data/orders.csv');

const hasLLMKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);

const required = [
  'GREEN_API_ID_INSTANCE',
  'GREEN_API_TOKEN',
  ...(hasLLMKey ? [] : ['GEMINI_API_KEY או OPENROUTER_API_KEY']),
  ...(hasLocalKnowledge ? [] : ['KNOWLEDGE_DOC_ID']),
  ...(hasLocalInventory ? [] : ['INVENTORY_SHEET_ID']),
  ...(hasLocalOrders ? [] : ['ORDERS_SHEET_ID']),
];

const missing = required.filter((k) => !process.env[k] && !k.includes('או'));
if (missing.length || !hasLLMKey) {
  const allMissing = [...missing, ...(!hasLLMKey ? ['GEMINI_API_KEY (או OPENROUTER_API_KEY)'] : [])];
  console.error(`חסרים משתני סביבה או קבצי נתונים: ${allMissing.join(', ')}`);
  console.error('מלאו את .env או הניחו קבצים מתאימים בתיקיית data/ (knowledge.txt, inventory.csv, orders.csv).');
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
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || (process.env.GEMINI_API_KEY ? 'gemini-2.5-flash' : 'openai/gpt-5.6-terra'),
    baseUrl:
      process.env.OPENROUTER_BASE_URL ||
      (process.env.GEMINI_API_KEY
        ? 'https://generativelanguage.googleapis.com/v1beta/openai'
        : 'https://openrouter.ai/api/v1'),
  },

  data: {
    knowledgeDocId: process.env.KNOWLEDGE_DOC_ID || (hasLocalKnowledge ? 'local:knowledge' : ''),
    inventorySheetId: process.env.INVENTORY_SHEET_ID || (hasLocalInventory ? 'local:inventory' : ''),
    ordersSheetId: process.env.ORDERS_SHEET_ID || (hasLocalOrders ? 'local:orders' : ''),

    // Google serves these from cache; 60s is short enough that an inventory
    // edit shows up during a demo, long enough not to refetch on every message.
    cacheSeconds: parseInt(process.env.DATA_CACHE_SECONDS || '60', 10),
  },
  // Public base for the catalogue pages. Render injects RENDER_EXTERNAL_URL,
  // Railway injects RAILWAY_PUBLIC_DOMAIN.
  siteBaseUrl:
    process.env.SITE_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
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
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  allowedSenders,
  memoryFile: process.env.MEMORY_FILE || './data/conversations.json',
  port: parseInt(process.env.PORT || '3000', 10),
});

