import fs from 'node:fs';

const env = {};
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

async function check() {
  const serviceId = 'srv-daqlanugekts7393g9tg';
  const deployId = 'dep-daqlao6gekts7393gblg';
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`, {
    headers: { Authorization: `Bearer ${env.RENDER_API_KEY}` }
  });
  const data = await res.json();
  console.log('Deploy Status:', data.status, '| Finished:', data.finishedAt || 'building...');

  const envRes = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    headers: { Authorization: `Bearer ${env.RENDER_API_KEY}` }
  });
  const envData = await envRes.json();
  console.log('Configured Env Vars on Render:', envData.map(e => e.envVar?.key));
}

check();
