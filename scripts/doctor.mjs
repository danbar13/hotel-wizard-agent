/**
 * בדיקת מוכנות — מה כבר מחובר ומה חסר.
 * שימוש:  node --env-file-if-exists=.env scripts/doctor.mjs
 *
 * מיועד להיקרא גם על ידי Antigravity בתחילת האונבורדינג. הפלט מסתיים
 * בשורת NEXT שאומרת באיזה שלב ב-ONBOARDING.md להתחיל, כדי שההחלטה
 * תתבסס על בדיקה בפועל ולא על ניחוש.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const ok = (s) => `✅ ${s}`;
const no = (s) => `❌ ${s}`;
const warn = (s) => `⚠️  ${s}`;

function sh(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim() };
  } catch (err) {
    return { ok: false, out: (err.stdout?.toString() || err.stderr?.toString() || '').trim() };
  }
}

function hasBin(bin) {
  const cmd = process.platform === 'win32' ? `where.exe ${bin}` : `command -v ${bin}`;
  return sh(cmd).ok;
}


/** .env is read by hand so the doctor runs even when the file is malformed. */
function readEnv() {
  if (!fs.existsSync('.env')) return null;
  const env = {};
  for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}


const missing = [];
const TEMPLATE_REPO = 'roeit10/whatsapp-business-agent';

// ---------- 0. ריפו משלכם ----------
console.log('\n\x1b[1m0. הריפו\x1b[0m');
const origin = sh('git remote get-url origin');
if (!origin.ok) {
  console.log(no('אין ריפו git — צריך ריפו משלכם שנוצר מהתבנית'));
  missing.push('own-repo');
} else if (origin.out.includes(TEMPLATE_REPO)) {
  // Working directly inside the shared template is the most common first
  // mistake: Railway cannot deploy from a repo the student does not own, and
  // any commit here would try to push to the course material.
  console.log(no(`עובדים בתוך התבנית עצמה (${TEMPLATE_REPO}) — צריך ריפו משלכם`));
  missing.push('own-repo');
} else {
  console.log(ok(`ריפו משלכם — ${origin.out.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')}`));
}

// ---------- 1. סביבת הרצה ----------
console.log('\n\x1b[1m1. סביבת הרצה\x1b[0m');
const major = Number(process.version.slice(1).split('.')[0]);
if (major >= 20) console.log(ok(`Node ${process.version}`));
else {
  console.log(no(`Node ${process.version} — נדרש 20 ומעלה`));
  missing.push('node');
}

// ---------- 2. כלי שורת פקודה ----------
console.log('\n\x1b[1m2. כלי שורת פקודה\x1b[0m');
const ghInstalled = hasBin('gh');
if (!ghInstalled) {
  console.log(no('GitHub CLI (gh) לא מותקן'));
  missing.push('gh-install');
} else {
  const auth = sh('gh auth status');
  if (auth.ok) {
    const who = auth.out.split('\n').find((l) => l.trim()) || '';
    console.log(ok(`GitHub CLI — ${who.replace(/\s+/g, ' ').slice(0, 60)}`));
  } else {
    console.log(no('GitHub CLI מותקן אבל לא מחובר — צריך: gh auth login'));
    missing.push('gh-login');
  }
}

if (fs.existsSync('render.yaml')) {
  console.log(ok('הגדרת פריסה ל-Render מוכנה (render.yaml)'));
} else {
  console.log(warn('קובץ render.yaml לא קיים לפריסה ברנדר'));
}


// ---------- 3. קובץ ההגדרות ----------
console.log('\n\x1b[1m3. קובץ ההגדרות (.env)\x1b[0m');
const env = readEnv();
if (!env) {
  console.log(no('.env לא קיים — יש להעתיק מ-.env.example'));
  missing.push('env-file');
} else {
  const localFiles = {
    KNOWLEDGE_DOC_ID: { label: 'מסמך הידע', local: fs.existsSync('data/knowledge.txt') || fs.existsSync('data/knowledge.md'), file: 'data/knowledge.txt' },
    INVENTORY_SHEET_ID: { label: 'גיליון המלאי', local: fs.existsSync('data/inventory.csv'), file: 'data/inventory.csv' },
    ORDERS_SHEET_ID: { label: 'גיליון ההזמנות', local: fs.existsSync('data/orders.csv'), file: 'data/orders.csv' },
  };

  for (const [key, label] of Object.entries({
    GREEN_API_ID_INSTANCE: 'Green API',
    GREEN_API_TOKEN: 'Green API',
  })) {
    if (env[key]) console.log(ok(`${key} (${label})`));
    else {
      console.log(no(`${key} חסר (${label})`));
      missing.push(key);
    }
  }

  if (env.GEMINI_API_KEY) {
    console.log(ok('GEMINI_API_KEY (Google Gemini API — חינם)'));
  } else if (env.OPENROUTER_API_KEY) {
    console.log(ok('OPENROUTER_API_KEY (OpenRouter)'));
  } else {
    console.log(no('GEMINI_API_KEY חסר (או OPENROUTER_API_KEY)'));
    missing.push('GEMINI_API_KEY');
  }

  for (const [key, info] of Object.entries(localFiles)) {
    if (info.local) {
      console.log(ok(`${key} (${info.label} — מקומי ב-${info.file})`));
    } else if (env[key]) {
      console.log(ok(`${key} (${info.label} — Google ID)`));
    } else {
      console.log(no(`${key} חסר (${info.label} — נדרש ID ב-.env או קובץ מקומי ב-${info.file})`));
      missing.push(key);
    }
  }

  if (env.OWNER_WHATSAPP) {
    console.log(ok(`OWNER_WHATSAPP (${env.OWNER_WHATSAPP}) — התראות מנהל פעילות`));
  } else {
    console.log(warn('OWNER_WHATSAPP לא מוגדר — הסוכן יפעל ללא שליחת התראות לבעל העסק'));
  }
}



// ---------- 4. בדיקות חיות ----------
console.log('\n\x1b[1m4. בדיקה מול השירותים\x1b[0m');

if (env?.GREEN_API_ID_INSTANCE && env?.GREEN_API_TOKEN) {
  const shard = String(env.GREEN_API_ID_INSTANCE).slice(0, 4);
  try {
    const r = await fetch(
      `https://${shard}.api.greenapi.com/waInstance${env.GREEN_API_ID_INSTANCE}/getStateInstance/${env.GREEN_API_TOKEN}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (r.status === 401) {
      console.log(no('Green API — הטוקן לא תקין'));
      missing.push('greenapi-token');
    } else {
      const { stateInstance } = await r.json();
      if (stateInstance === 'authorized') console.log(ok('Green API — מחובר לוואטסאפ'));
      else {
        // `starting` is a transient boot state, not a broken instance.
        console.log(warn(`Green API — מצב "${stateInstance}". אם זה נמשך, לסרוק QR או ללחוץ אתחול בקונסולה`));
        missing.push('greenapi-scan');
      }
    }
  } catch {
    console.log(no('Green API — לא הצלחתי להגיע לשירות'));
    missing.push('greenapi-reach');
  }
} else console.log('⏭️  Green API — מדלג, אין מפתחות');

if (env?.GEMINI_API_KEY) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/models', {
      headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      console.log(ok('Google Gemini — המפתח תקין ומחובר בחינם!'));
    } else {
      console.log(no(`Google Gemini — המפתח נדחה (${r.status})`));
      missing.push('gemini-key');
    }
  } catch {
    console.log(no('Google Gemini — לא הצלחתי להגיע לשירות'));
    missing.push('gemini-reach');
  }
} else if (env?.OPENROUTER_API_KEY) {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const d = await r.json();
      const left = d?.data?.limit_remaining;
      console.log(ok(`OpenRouter — המפתח תקין${left != null ? ` · נותרו $${left}` : ''}`));
    } else {
      console.log(no(`OpenRouter — המפתח נדחה (${r.status})`));
      missing.push('openrouter-key');
    }
  } catch {
    console.log(no('OpenRouter — לא הצלחתי להגיע לשירות'));
    missing.push('openrouter-reach');
  }
} else console.log('⏭️  מוח ה-AI (Gemini / OpenRouter) — מדלג, אין מפתח');


const googleFiles = [
  ['KNOWLEDGE_DOC_ID', 'מסמך הידע', (id) => `https://docs.google.com/document/d/${id}/export?format=txt`, 'data/knowledge.txt'],
  ['INVENTORY_SHEET_ID', 'גיליון המלאי', (id) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, 'data/inventory.csv'],
  ['ORDERS_SHEET_ID', 'גיליון ההזמנות', (id) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, 'data/orders.csv'],
];
for (const [key, label, url, localPath] of googleFiles) {
  if (fs.existsSync(localPath) || (localPath.endsWith('.txt') && fs.existsSync('data/knowledge.md'))) {
    console.log(ok(`${label} — קובץ מקומי תקין (${localPath})`));
    continue;
  }
  if (!env?.[key]) {
    console.log(`⏭️  ${label} — מדלג, אין מזהה או קובץ מקומי`);
    continue;
  }
  try {
    const r = await fetch(url(env[key]), { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const body = r.ok ? await r.text() : '';
    // A file that is not link-shared redirects to a Google sign-in page, which
    // still returns 200 — so check the body, not just the status.
    if (r.ok && !/<html/i.test(body.slice(0, 200))) console.log(ok(`${label} — קריא`));
    else {
      console.log(no(`${label} — לא קריא. צריך לשתף ב"כל מי שיש לו את הקישור — צפייה"`));
      missing.push(`${key}-share`);
    }
  } catch {
    console.log(no(`${label} — לא הצלחתי להגיע`));
    missing.push(`${key}-reach`);
  }
}


if (env?.SUPABASE_URL && (env?.SUPABASE_KEY || env?.SUPABASE_ANON_KEY)) {
  const key = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY;
  try {
    const r = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/conversations?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      console.log(ok('Supabase — מחובר וטבלת השיחות (conversations) קיימת ופעילה'));
    } else if (r.status === 404) {
      console.log(warn('Supabase — מחובר ומאומת! (נדרש להריץ את ה-SQL ליצירת טבלת conversations)'));
    } else {
      console.log(warn(`Supabase — השיב בסטטוס ${r.status}, נא לוודא מפתח וכתובת URL`));
    }
  } catch {
    console.log(warn('Supabase — לא הצלחתי להגיע לשירות'));
  }
} else {
  console.log('ℹ️  Supabase — לא הוגדר (הסוכן ישמור היסטוריה בקובץ מקומי data/conversations.json)');
}



// ---------- סיכום ----------
console.log('\n' + '─'.repeat(58));
if (!missing.length) {
  console.log('\x1b[32m\x1b[1mהכל מחובר. אפשר להתחיל.\x1b[0m');
  console.log('NEXT: READY');
  process.exit(0);
}

// Installs come before STEP 0 even though STEP 0 is numbered first: creating the
// repo from the template needs `gh`, so pointing at STEP 0 while gh is missing
// sends the agent to a command that cannot run.
const step =
  missing.some((m) => m.endsWith('-install')) ? 'STEP 1'
  : missing.some((m) => m.endsWith('-login')) ? 'STEP 2'
  : missing.includes('own-repo') ? 'STEP 0'
  : missing.some((m) => m.startsWith('GREEN_API') || m.startsWith('greenapi')) ? 'STEP 3'
  : missing.some((m) => m.startsWith('OPENROUTER') || m.startsWith('openrouter')) ? 'STEP 4'
  : 'STEP 5';

console.log(`\x1b[33mחסרים ${missing.length} דברים:\x1b[0m ${missing.join(', ')}`);
console.log(`NEXT: ${step}  (ראו ONBOARDING.md)`);
process.exit(1);
