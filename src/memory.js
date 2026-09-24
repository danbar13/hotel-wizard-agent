import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

// Keep the last N entries (15 exchanges) per contact. At 12 the opening of a
// normal shop conversation was already being trimmed away mid-chat. Tool call/result pairs are dropped before
// storing: they are large, they go stale within minutes (stock changes), and
// replaying them invites the model to answer from an old tool result instead of
// calling the tool again.
const MAX_TURNS = 30;

let store = {};

function load() {
  try {
    store = JSON.parse(fs.readFileSync(config.memoryFile, 'utf8'));
  } catch {
    store = {};
  }
}

function persistLocal() {
  try {
    fs.mkdirSync(path.dirname(config.memoryFile), { recursive: true });
    fs.writeFileSync(config.memoryFile, JSON.stringify(store));
  } catch (err) {
    // Never let a disk problem take down an answer that already succeeded.
    console.error('[memory] כתיבה מקומית נכשלה:', err.message);
  }
}

load();

export async function getHistory(chatId) {
  if (store[chatId]) return store[chatId];
  if (config.supabase?.url && config.supabase?.key) {
    try {
      const url = `${config.supabase.url.replace(/\/$/, '')}/rest/v1/conversations?chat_id=eq.${encodeURIComponent(chatId)}&select=turns`;
      const res = await fetch(url, {
        headers: {
          apikey: config.supabase.key,
          Authorization: `Bearer ${config.supabase.key}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]?.turns) {
          store[chatId] = rows[0].turns;
          return store[chatId];
        }
      }
    } catch (err) {
      console.error('[memory] שגיאה במשיכת היסטוריה מסופהבייס:', err.message);
    }
  }
  return store[chatId] || [];
}

export async function remember(chatId, userText, assistantText) {
  const turns = [
    ...(store[chatId] || []),
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText },
  ];
  store[chatId] = turns.slice(-MAX_TURNS);
  persistLocal();

  if (config.supabase?.url && config.supabase?.key) {
    try {
      const url = `${config.supabase.url.replace(/\/$/, '')}/rest/v1/conversations`;
      await fetch(url, {
        method: 'POST',
        headers: {
          apikey: config.supabase.key,
          Authorization: `Bearer ${config.supabase.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          chat_id: chatId,
          turns: store[chatId],
          updated_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.error('[memory] שגיאה בשמירה בסופהבייס:', err.message);
    }
  }
}

export async function forget(chatId) {
  delete store[chatId];
  persistLocal();

  if (config.supabase?.url && config.supabase?.key) {
    try {
      const url = `${config.supabase.url.replace(/\/$/, '')}/rest/v1/conversations?chat_id=eq.${encodeURIComponent(chatId)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: config.supabase.key,
          Authorization: `Bearer ${config.supabase.key}`,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.error('[memory] שגיאה במחיקה מסופהבייס:', err.message);
    }
  }
}

