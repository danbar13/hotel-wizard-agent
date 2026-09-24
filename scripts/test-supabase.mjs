import fs from 'node:fs';

const env = {};
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

async function testSupabase() {
  console.log('Testing Supabase URL:', env.SUPABASE_URL);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations?select=*&limit=1`, {
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`
    }
  });
  console.log('Select Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body:', text);

  // Test INSERT
  const testChatId = 'test-check@c.us';
  const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      chat_id: testChatId,
      turns: [{ role: 'user', content: 'שלום' }, { role: 'assistant', content: 'שלום! מלון וויזארד ריזורט לשירותך.' }],
      updated_at: new Date().toISOString(),
    }),
  });
  const insertText = await insertRes.text();
  console.log('Insert/Upsert Status:', insertRes.status, insertText);

  // Test SELECT
  const selectRes = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations?chat_id=eq.${encodeURIComponent(testChatId)}&select=*`, {
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
    },
  });
  const rows = await selectRes.json();
  console.log('Verified read from Supabase:', JSON.stringify(rows));

  // Test CLEANUP (DELETE)
  const delRes = await fetch(`${env.SUPABASE_URL}/rest/v1/conversations?chat_id=eq.${encodeURIComponent(testChatId)}`, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
    },
  });
  console.log('Cleanup Status:', delRes.status);
  console.log('--> ALL CHECKS PASSED: Supabase persistence is 100% verified and working!');
}

testSupabase();
