import config from './config.js';
import { getKnowledgeText, getSheetRows } from './data/google.js';
import { sendMessage } from './green-api.js';

/**
 * Tool schemas handed to the model. Descriptions are prescriptive about *when*
 * to call each one — that is what drives the model to actually use them instead
 * of answering from its own guesses.
 */
export const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'get_shop_info',
      description:
        'מחזיר את מאגר הידע של מלון וויזארד ריזורט & ספא: שעות קבלה וצ\'ק-אין/צ\'ק-אאוט, שירותי המלון, ' +
        'טיולים מודרכים לירח, מסעדות המלון, מתחם הספא והבריכות, חניה ושאטלים, ומדיניות ביטולים. ' +
        'יש לקרוא לכלי הזה לכל שאלה על נהלים, שעות, שירותים או מדיניות. אין לענות על שאלות כאלה מהזיכרון.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description:
        'בודק זמינות, מאפיינים ומחיר של חדרים, סוויטות, טיולים לירח, טיפולי ספא וחוויות במלון וויזארד. ' +
        'יש לקרוא לכלי הזה לכל שאלה בנוסח "כמה עולה חדר", "איזה סוויטות יש", "כמה עולה טיול לירח", "יש מקום פנוי". ' +
        'חיפוש חופשי לפי שם חדר, חוויה או קטגוריה (לדוגמה "נובה אורביטלי", "טיול לירח", "סוויטת אפס כבידה", "ספא").',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'שם החדר, הסוויטה, הטיול או השירות המבוקש במלון',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_order',
      description:
        'מחזיר את כל היסטוריית ההזמנות של הלקוח ששלח את ההודעה, מהחדשה לישנה, ' +
        'כולל תאריך הזמנה, פריטים, סטטוס ותאריך משלוח צפוי. ' +
        'קרא לכלי הזה גם לשאלות על משלוח ("איפה ההזמנה שלי", "מתי מגיע"), וגם כשאתה רוצה להבין ' +
        'מה הלקוח נוהג לקנות כדי להמליץ לו או להזכיר לו לחדש מלאי. ' +
        'הזיהוי אוטומטי לפי מספר הוואטסאפ של השולח. העבר order_number רק אם הלקוח ציין מספר במפורש.',
      parameters: {
        type: 'object',
        properties: {
          order_number: {
            type: 'string',
            description: 'מספר הזמנה, רק אם הלקוח ציין אותו במפורש בהודעה',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notify_owner',
      description:
        'שולח לבעל העסק הודעת וואטסאפ קצרה על לקוח שצריך את תשומת לבו. ' +
        'קרא לכלי הזה רק בשני מקרים: (1) לא מצאת תשובה באף מקור — לא במאגר הידע, לא במלאי ולא בהזמנות — ' +
        'והפנית את הלקוח לבעל העסק; (2) הלקוח ביקש במפורש שיחזרו אליו או השאיר פרטים ליצירת קשר. ' +
        'קרא לו רק אחרי שכבר ענית ללקוח. המספר של הלקוח מזוהה אוטומטית — אין צורך להעביר אותו.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: ['לא_ידעתי', 'ביקש_שיחזרו'],
            description: 'למה בעל העסק צריך לדעת על זה',
          },
          summary: {
            type: 'string',
            description: 'משפט אחד: מה הלקוח רצה',
          },
          customer_phone: {
            type: 'string',
            description: 'מספר הטלפון של הלקוח (אופציונלי)',
          },
        },
        required: ['reason', 'summary'],
      },
    },
  },
].filter((t) => t.function.name !== 'notify_owner' || Boolean(config.business.ownerWhatsapp));


/**
 * Customers and spreadsheets never spell units the same way: "2 קילו" vs "2 קג",
 * ק"ג with a quote vs without. Fold them onto one form before comparing, or every
 * size-qualified question misses.
 */
/** ISO date for today, so date arithmetic never depends on the model guessing. */
const today = () => new Date().toISOString().slice(0, 10);

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/["'׳״]/g, '')
    .replace(/\bקילוגרם\b|\bקילו\b|\bקג\b|\bkg\b/g, 'קג')
    .replace(/\bליטרים\b|\bליטר\b/g, 'ליטר')
    .replace(/\s+/g, ' ')
    .trim();

/** Character bigrams, for comparing words that are close but not identical. */
function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

/** Normalised edit distance, 0 to 1. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/**
 * Customers mangle brand names constantly, and the two measures fail on
 * different shapes. Bigrams handle inserted/dropped letters well but collapse
 * when two characters change: "הקרנה" against "אקאנה" scores 0.25 on bigrams
 * and 0.6 on edit distance, because only two of five letters differ. Taking the
 * better of the two catches both kinds of typo.
 */
function similarity(a, b) {
  if (a === b) return 1;
  return Math.max(dice(a, b), levenshtein(a, b));
}

const FUZZY_THRESHOLD = 0.58;
// Short words are too easy to mutate into each other ("חול" vs "חתול" scores
// 0.75), so fuzzy matching only applies from four characters up.
const FUZZY_MIN_LENGTH = 4;

// Words that carry no signal in a product query and would otherwise inflate the
// score of unrelated rows.
const STOPWORDS = new Set([
  'יש','לכם','לך','אני','צריך','צריכה','רוצה','מחפש','מחפשת','את','של','עם',
  'כמה','עולה','במלאי','בבקשה','היי','שלום','אפשר','לקנות','מה','המחיר','זה',
]);

/**
 * What the model is allowed to see about a product.
 * The raw stock count never leaves this function: the shop does not want
 * "we have 14 left" quoted at customers, and an instruction not to say it is
 * weaker than simply not providing it. Same principle as closing over the
 * sender's phone below.
 */
const isAvailable = (row) => Number(row['כמות במלאי'] || 0) > 0;

function publicProduct(row) {
  const { 'כמות במלאי': qty, ...rest } = row;
  return {
    ...rest,
    זמינות: Number(qty || 0) > 0 ? 'במלאי' : 'אזל מהמלאי',
    ...(config.siteBaseUrl && row['מקט']
      ? { 'קישור לעמוד המוצר': `${config.siteBaseUrl}/p/${row['מקט']}` }
      : {}),
  };
}

/** Strip everything but digits so 050-123-4567 and 972501234567 compare equal. */
const digits = (s) => String(s || '').replace(/\D/g, '');

/**
 * The sender's phone is closed over here rather than passed as a tool argument.
 * A model that could pass an arbitrary phone number could be talked into reading
 * someone else's order ("check the order for 05X-XXXXXXX") — closing over the
 * value taken from the webhook makes that impossible.
 */
const notifiedContacts = new Set();

export function resetNotified(phone) {
  if (phone) notifiedContacts.delete(digits(phone));
  else notifiedContacts.clear();
}

export function buildExecutors(senderPhone) {


  // Side effects that must wait until the customer has been answered.
  const pending = [];
  const executors = {
    async get_shop_info() {
      return await getKnowledgeText();
    },

    async check_inventory({ query }) {
      const rows = await getSheetRows(config.data.inventorySheetId);
      const terms = norm(query)
        .split(' ')
        .filter((t) => t && !STOPWORDS.has(t));

      // Rank by how many query terms a row matches rather than requiring all of
      // them. Requiring all means one stray word ("קילו" against a "קג" sheet)
      // turns a product that is clearly in stock into "not found".
      // A term counts if it appears literally, or if it is close enough to one
      // of the row's words to be an obvious misspelling of it.
      const score = (r) => {
        const hay = norm(Object.values(r).join(' '));
        const words = hay.split(' ').filter(Boolean);
        return terms.filter(
          (t) =>
            hay.includes(t) ||
            (t.length >= FUZZY_MIN_LENGTH &&
              words.some((w) => similarity(t, w) >= FUZZY_THRESHOLD))
        ).length;
      };

      const scored = rows
        .map((r) => ({ row: r, score: score(r) }))
        .filter((x) => x.score > 0)
        // Within the same relevance, an item on the shelf beats one that is out.
        // Ranking on text alone once sent a customer a link to a product that
        // had already sold out, while an equivalent in-stock size sat unshown.
        .sort(
          (a, b) =>
            b.score - a.score || Number(isAvailable(b.row)) - Number(isAvailable(a.row))
        );

      const best = scored.length ? scored[0].score : 0;
      const tied = scored.filter((x) => x.score === best);
      const matches = tied.slice(0, 12).map((x) => publicProduct(x.row));

      if (!matches.length) {
        return (
          `לא נמצאה התאמה ישירה ל"${query}". להלן רשימת החדרים, הסוויטות והאטרקציות המלאה במלון:\n` +
          'עבור על הרשימה ובדוק למה האורח התכוון (לדוגמה חדרים פנורמיים, סוויטות כבידה אפסית, טיולים לירח וכדומה):\n' +
          JSON.stringify(rows.map(publicProduct), null, 1)
        );
      }
      const head =
        tied.length > 4
          ? `נמצאו ${tied.length} אפשרויות המתאימות לבקשה (מוצגות ${matches.length}). ` +
            'ניתן לברר עם האורח פרטים נוספים (כמות אורחים, תאריכים מבוקשים) ולהמליץ על האפשרות המובילה.\n'
          : '';

      // If everything that matched is out of stock, never hand back a dead end.
      // Surface in-stock items from the same categories so the answer can be
      // "that one is out, but here is what I do have".
      let tail = '';
      if (!tied.some((x) => isAvailable(x.row))) {
        const cats = new Set(tied.map((x) => x.row['קטגוריה']));
        // Rank alternatives by who the product is FOR, not by how well they match
        // the words the customer typed. Ranking on the query text put five adult
        // cat foods in front of someone asking for kitten food, purely because
        // they shared a brand name — the one thing that does not matter here.
        const wantedFor = norm(tied[0].row['מתאים ל'] || '');
        const fit = (r) => (wantedFor ? similarity(wantedFor, norm(r['מתאים ל'] || '')) : 0);

        const alternatives = rows
          .filter((r) => cats.has(r['קטגוריה']) && isAvailable(r))
          .map((r) => ({ row: r, fit: fit(r), score: score(r) }))
          .sort((a, b) => b.fit - a.fit || b.score - a.score)
          .slice(0, 5)
          .map((x) => publicProduct(x.row));

        tail = alternatives.length
          ? '\n\nכל מה שתאם לבקשה אזל מהמלאי. אלה חלופות זמינות מאותה קטגוריה — ' +
            'אמור ללקוח שהמוצר שביקש אזל, והצע לו אחת מהן במשפט אחד:\n' +
            JSON.stringify(alternatives, null, 1)
          : '\n\nכל מה שתאם לבקשה אזל, ואין כרגע שום חלופה זמינה באותה קטגוריה. ' +
            'אמור את זה בכנות, אל תשלח קישור למוצר שאזל כאילו הוא פתרון, ' +
            'והצע ללקוח לעדכן אותו כשהמוצר חוזר למלאי.';
      }

      return head + JSON.stringify(matches, null, 1) + tail;
    },

    async lookup_order({ order_number } = {}) {
      const rows = await getSheetRows(config.data.ordersSheetId);
      const phoneKey = digits(senderPhone);

      const byPhone = rows
        .filter((r) => digits(r['טלפון']) === phoneKey)
        .sort((a, b) => String(b['תאריך הזמנה']).localeCompare(String(a['תאריך הזמנה'])));
      if (byPhone.length) {
        return (
          `היסטוריית ההזמנות של הלקוח, מהחדשה לישנה. היום ${today()}.\n` +
          JSON.stringify(byPhone, null, 1)
        );
      }

      if (order_number) {
        const byNumber = rows.filter(
          (r) => norm(r['מספר הזמנה']) === norm(order_number)
        );
        if (byNumber.length) return JSON.stringify(byNumber, null, 1);
        return `לא נמצאה הזמנה עם מספר ${order_number}.`;
      }

      return (
        'לא נמצאה הזמנה שמשויכת למספר הטלפון שממנו נשלחה ההודעה. ' +
        'יש לבקש מהלקוח מספר הזמנה, או להפנות אותו לבעל העסק.'
      );
    },

    async notify_owner({ reason, summary, customer_phone }) {
      const owner = config.business.ownerWhatsapp;
      if (!owner) return 'OWNER_WHATSAPP לא מוגדר, ההודעה לבעל העסק לא נשלחה.';

      const clientPhone = digits(customer_phone || senderPhone);
      if (notifiedContacts.has(clientPhone)) {
        return 'כבר נשלחה הודעה לבעל העסק עבור לקוח זה בשיחה זו. אין לשלוח שוב.';
      }
      notifiedContacts.add(clientPhone);

      const label = reason === 'ביקש_שיחזרו' ? 'לקוח ביקש שיחזרו אליו' : 'לא נמצאה תשובה במקורות המידע והלקוח הופנה אליך';
      const text = `סיבה: ${label}\nלקוח: ${clientPhone}\nמה הלקוח רצה: ${summary}`;

      pending.push(() => sendMessage(`${owner}@c.us`, text));
      return 'ההודעה תישלח לבעל העסק מיד אחרי שהלקוח יקבל את התשובה שלך.';
    },

  };
  const afterReply = async () => {
    for (const fn of pending.splice(0)) {
      await fn().catch((err) => console.error(`[notify_owner] ${err.message}`));
    }
  };
  return { executors, afterReply };
}
