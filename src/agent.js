import config from './config.js';
import { toolSchemas, buildExecutors } from './tools.js';
import { getSheetRows } from './data/google.js';

const MAX_TOOL_ROUNDS = 5;

/** First name of a returning customer, matched on the sender's phone. */
async function lookupCustomerName(senderPhone) {
  const key = String(senderPhone).replace(/\D/g, '');
  const rows = await getSheetRows(config.data.ordersSheetId);
  const row = rows.find((r) => String(r['טלפון'] || '').replace(/\D/g, '') === key);
  return row?.['שם לקוח']?.split(' ')[0] || null;
}

function systemPrompt(customerName) {
  const { name, ownerName, ownerPhone } = config.business;
  const contact = ownerPhone ? `${ownerName} בטלפון ${ownerPhone}` : ownerName;
  const who = customerName
    ? `\nהאורח שכותב לך הוא ${customerName}, אורח מוכר של המלון. אפשר לפנות אליו בשמו באופן אישי ונעים.`
    : '';

  return `אתה קונסיירז' דיגיטלי ונציג שירות לקוחות אישי בוואטסאפ של ${name}. אתה עונה לאורחים ומטיילים במקום הנהלת המלון.${who}

## תחום העיסוק שלך
אתה עונה על כל נושא שקשור למלון וויזארד ריזורט & ספא:
- 5 סוגי החדרים והסוויטות העתידניים (קפסולת סייבר-דלוקס, חדר פנורמי נובה אורביטלי, סוויטת כבידה אפסית Zero-G, סוויטת גלקטיק ג'וניור מנהלים, ופנטהאוז נשיאותי קוונטי).
- אטרקציות וטיולים עתידניים, בדגש על הטיול המודרך האקסקלוסיבי לירח (Guided Lunar Shuttle Expedition), סיורי רחפני VIP ועוד.
- שירותי ספא קוונטי, הידרותרפיה ביו-סונית ותאי חמצן מועשרים.
- קולינריה עתידנית, ארוחות שף מולקולריות ומסעדות המלון (Cyber Wizard, La Plaza 2050).
- זמינות, מחירים, תיאום הזמנות, שעות צ'ק-אין (15:00) וצ'ק-אאוט (11:00), שאטלים ומדיניות המלון.

הודעה נחשבת **מחוץ לתחום רק כשהיא בקשה ברורה לתוכן שאינו קשור למלון**: מתכון, חדשות, פוליטיקה, קוד, שיעורי בית. במקרה כזה ענה במשפט שירותי: "אני כאן לשירותכם בכל שאלה לגבי חופשה ואירוח במלון וויזארד ריזורט 🙂 איך אוכל לעזור?"

## דיוק ושירות
- כל עובדה שאתה מוסר — מחיר לילה, שעות, זמינות, פרטי טיול ירח — חייבת להגיע מכלי המידע (get_shop_info / check_inventory / lookup_order).
- חדר או חוויה שלא נמצאו אינם "אזלו". בדוק בקטלוג והצע חלופה הולמת או שאל את האורח למה התכוון.
- לעולם אל תנקוב במספר החדרים המדויק שנשאר. אמור "יש מקום פנוי" או "התפוסה מלאה בתאריכים אלו".
- כשאתה ממליץ על חדר או שירות ספציפי, צרף את הקישור לעמוד מתוצאת הכלי בשורה נפרדת.
- כשצריך החלטה ניהולית, בקשה מיוחדת או סגירת הזמנה סופית — הפנה ל${contact}.

## איך לענות
- עברית רהוטה, חמה, אדיבה ויוקרתית כיאה למלון 5 כוכבים דלוקס עתידני.
- הודעות קצרות וקולעות (2-4 שורות ברוב המקרים).
- שירותי, מסביר פנים ואינפורמטיבי.

## שאלות ובירורים
- אם האורח מתעניין בחדר, ברר בנימוס: כמה אורחים מגיעים (זוג, יחיד, משפחה עם ילדים) או מה סגנון החופשה המבוקש.
- תמיד הצג מחיר ברור ללילה או לחוויה.
- הצע חוויות משלימות באופן יוקרתי ומדוד (למשל: שילוב טיול מודרך לירח עם סוויטה פנורמית, או טיפול בספא הקוונטי).

## עדכון הנהלת המלון
השתמש בכלי notify_owner אך ורק כשלא מצאת מענה במקורות המידע או כשהאורח מבקש שנציג יחזור אליו טלפונית לתיאום מותאם אישית.`;
}

async function callModel(messages, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openrouter.model,
        messages,
        tools: toolSchemas,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if ((res.status === 503 || res.status === 429) && attempt < retries) {
        console.warn(`[llm] שגיאה זמנית ${res.status}, מנסה שוב בעוד 2 שניות (ניסיון ${attempt + 1})...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`LLM ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (data.error) {
      if ((data.error.code === 503 || data.error.code === 429) && attempt < retries) {
        console.warn(`[llm] שגיאה זמנית ${data.error.code}, מנסה שוב בעוד 2 שניות...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`LLM: ${JSON.stringify(data.error)}`);
    }
    return data.choices[0].message;
  }
}


/**
 * One agent turn: model → tool calls → model → … until it answers in text.
 * `history` is the prior conversation for this contact (not mutated).
 */
export async function answer({ text, senderPhone, history = [] }) {
  const { executors, afterReply } = buildExecutors(senderPhone);
  // Greeting a returning customer by name is the cheapest bit of humanity we
  // can add. The orders sheet is cached, so this costs nothing extra.
  const customerName = await lookupCustomerName(senderPhone).catch(() => null);

  const messages = [
    { role: 'system', content: systemPrompt(customerName) },
    ...history,
    { role: 'user', content: text },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await callModel(messages);
    messages.push(message);

    const calls = message.tool_calls || [];
    if (!calls.length) {
      return { reply: message.content?.trim() || '', messages, afterReply };
    }

    // Every tool_call id must come back with a matching tool message, including
    // failures — a missing one makes the next request 400 on the provider side.
    for (const call of calls) {
      const fn = executors[call.function.name];
      let result;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = fn
          ? await fn(args)
          : `כלי לא מוכר: ${call.function.name}`;
      } catch (err) {
        result = `שגיאה בהרצת הכלי: ${err.message}`;
      }
      console.log(`[tool] ${call.function.name} ${call.function.arguments || '{}'}`);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: String(result),
      });
    }
  }

  return {
    reply:
      `לא הצלחתי להשלים את הבדיקה. עדיף לבדוק את זה מול ${config.business.ownerName}` +
      (config.business.ownerPhone ? ` בטלפון ${config.business.ownerPhone}.` : '.'),
    messages,
    afterReply,
  };
}
