import fs from 'node:fs';

function readEnv() {

  const env = {};
  for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[2].trim()) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv();
const RENDER_API_KEY = env.RENDER_API_KEY;
const OWNER_ID = 'tea-daqhfo8u01pc7386hg6g';


const envVars = [
  { key: 'PORT', value: '10000' },
  { key: 'NODE_VERSION', value: '20' },
  { key: 'GREEN_API_ID_INSTANCE', value: env.GREEN_API_ID_INSTANCE || '' },
  { key: 'GREEN_API_TOKEN', value: env.GREEN_API_TOKEN || '' },
  { key: 'GEMINI_API_KEY', value: env.GEMINI_API_KEY || '' },
  { key: 'OPENROUTER_MODEL', value: env.OPENROUTER_MODEL || 'gemini-3.6-flash' },
  { key: 'BUSINESS_NAME', value: env.BUSINESS_NAME || 'מלון וויזארד ריזורט & ספא' },
  { key: 'OWNER_NAME', value: env.OWNER_NAME || 'דני' },
  { key: 'OWNER_PHONE', value: env.OWNER_PHONE || '03-5551234' },
  { key: 'OWNER_WHATSAPP', value: env.OWNER_WHATSAPP || '972525340230' },
  { key: 'SUPABASE_URL', value: env.SUPABASE_URL || '' },
  { key: 'SUPABASE_KEY', value: env.SUPABASE_KEY || '' },
  ...(env.ALLOWED_SENDERS ? [{ key: 'ALLOWED_SENDERS', value: env.ALLOWED_SENDERS }] : []),
];

const payload = {
  type: 'web_service',
  name: 'hotel-wizard-agent',
  ownerId: OWNER_ID,
  repo: 'https://github.com/danbar13/hotel-wizard-agent',
  branch: 'main',
  autoDeploy: 'yes',
  envVars,
  serviceDetails: {
    runtime: 'node',
    plan: 'free',
    healthCheckPath: '/health',
    envSpecificDetails: {
      buildCommand: 'npm install',
      startCommand: 'npm start',
    },
  },
};

console.log('Sending creation request to Render API...');
const res = await fetch('https://api.render.com/v1/services', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(payload),
});

const data = await res.json();
console.log('STATUS:', res.status);
console.log(JSON.stringify(data, null, 2));
