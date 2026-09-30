import fs from 'node:fs';

const env = {};
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const envVars = [
  { key: 'PORT', value: '10000' },
  { key: 'NODE_VERSION', value: '20' },
  { key: 'GREEN_API_ID_INSTANCE', value: env.GREEN_API_ID_INSTANCE || '' },
  { key: 'GREEN_API_TOKEN', value: env.GREEN_API_TOKEN || '' },
  { key: 'GEMINI_API_KEY', value: env.GEMINI_API_KEY || '' },
  { key: 'OPENROUTER_MODEL', value: env.OPENROUTER_MODEL || 'gemini-3.6-flash' },
  { key: 'BUSINESS_NAME', value: 'מלון וויזארד ריזורט & ספא' },
  { key: 'OWNER_NAME', value: env.OWNER_NAME || 'דני' },
  { key: 'OWNER_PHONE', value: env.OWNER_PHONE || '03-5551234' },
  { key: 'OWNER_WHATSAPP', value: env.OWNER_WHATSAPP || '972525340230' },
  { key: 'SHOP_WHATSAPP', value: '972525340230' },
  { key: 'SUPABASE_URL', value: env.SUPABASE_URL || '' },
  { key: 'SUPABASE_KEY', value: env.SUPABASE_KEY || '' },
];

console.log('Syncing all env vars to Render...');
const res = await fetch('https://api.render.com/v1/services/srv-daqlanugekts7393g9tg/env-vars', {
  method: 'PUT',
  headers: {
    Authorization: 'Bearer ' + env.RENDER_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(envVars)
});

const data = await res.json();
console.log('Status:', res.status);
console.log('Restored env vars on Render:', data.map(e => e.envVar?.key));
