import config from './config.js';
import { getSheetRows, getKnowledgeText } from './data/google.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const inStock = (row) => Number(row['כמות במלאי'] || 0) > 0;
const catUrl = (c) => `/c/${encodeURIComponent(c)}`;

const CAT_ICON = {
  'חדרים עתידניים': '🛸',
  'סוויטות עתידניות': '🌌',
  'אטרקציות וטיולים': '🌕',
  'ספא ורווחה': '🧖',
  'קולינריה עתידנית': '🍸',
  'תוספות ושדרוגים': '✨',
  'שירותים': '🚀',
};

const DEFAULT_ROOM_IMAGES = {
  'RM-101': '/images/room_cyber_deluxe.jpg',
  'RM-102': '/images/room_nova_panorama.jpg',
  'RM-103': '/images/room_zero_g_suite.jpg',
  'RM-104': '/images/room_galactic_suite.jpg',
  'RM-105': '/images/room_quantum_penthouse.jpg',
  'EXC-501': '/images/lunar_excursion.jpg',
  'EXC-502': '/images/hotel_hero.jpg',
};

function getItemImage(row) {
  if (row['תמונה']) return row['תמונה'];
  if (DEFAULT_ROOM_IMAGES[row['מקט']]) return DEFAULT_ROOM_IMAGES[row['מקט']];
  if (row['קטגוריה']?.includes('סוויטות')) return '/images/room_galactic_suite.jpg';
  if (row['קטגוריה']?.includes('אטרקציות') || row['שם המוצר']?.includes('ירח')) return '/images/lunar_excursion.jpg';
  if (row['קטגוריה']?.includes('ספא')) return '/images/room_quantum_penthouse.jpg';
  return '/images/hotel_hero.jpg';
}

function getWhatsAppUrl(text = '') {
  const phone = config.shopWhatsapp || '972525340230';
  const defaultMsg = 'שלום! אשמח לפרטים ולהזמנת חופשה במלון וויזארד ריזורט & ספא';
  const msg = encodeURIComponent(text || defaultMsg);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${msg}`;
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#070b14;
  --surface:#0e1626;
  --surface-card:#142036;
  --line:rgba(0,229,255,0.18);
  --line-light:rgba(255,255,255,0.1);
  --cyan:#00e5ff;
  --cyan-glow:rgba(0,229,255,0.35);
  --gold:#ffd166;
  --wa:#25d366;
  --wa-dark:#1da851;
  --ink:#f1f5f9;
  --mut:#94a3b8;
}
body{
  font-family:-apple-system,"Segoe UI",Rubik,Arial,sans-serif;
  background:var(--bg);
  color:var(--ink);
  line-height:1.65;
  background-image:radial-gradient(circle at 50% 0%, rgba(0,229,255,0.08) 0%, transparent 60%);
  background-attachment:fixed;
  direction:rtl;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}

/* Navbar */
nav{
  background:rgba(7,11,20,0.88);
  backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line);
  position:sticky;
  top:0;
  z-index:99;
}
nav .wrap{display:flex;align-items:center;gap:28px;height:72px}
nav .logo{
  font-weight:900;
  font-size:21px;
  color:#fff;
  display:flex;
  align-items:center;
  gap:10px;
  letter-spacing:.03em;
}
nav .logo span{color:var(--cyan);text-shadow:0 0 12px var(--cyan-glow)}
nav .links{display:flex;gap:24px;font-size:15px;color:var(--mut);font-weight:500}
nav .links a{transition:.2s}
nav .links a:hover{color:var(--cyan);text-shadow:0 0 8px var(--cyan-glow)}
nav .cta{
  margin-inline-start:auto;
  background:linear-gradient(135deg,var(--wa),var(--wa-dark));
  color:#fff;
  padding:10px 20px;
  border-radius:10px;
  font-weight:700;
  font-size:14.5px;
  display:flex;
  align-items:center;
  gap:8px;
  box-shadow:0 4px 14px rgba(37,211,102,0.3);
  transition:.2s;
}
nav .cta:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(37,211,102,0.45)}

/* Hero Section */
.hero{
  position:relative;
  min-height:560px;
  display:flex;
  align-items:center;
  background:linear-gradient(to bottom, rgba(7,11,20,0.4) 0%, rgba(7,11,20,0.92) 85%, var(--bg) 100%),
             url('/images/hotel_hero.jpg') center/cover no-repeat;
  border-bottom:1px solid var(--line);
  padding:80px 0 90px;
}
.hero-content{max-width:760px}
.badge-hero{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:rgba(0,229,255,0.12);
  border:1px solid var(--cyan);
  color:var(--cyan);
  font-size:13px;
  font-weight:700;
  padding:6px 14px;
  border-radius:99px;
  margin-bottom:18px;
  text-shadow:0 0 8px var(--cyan-glow);
}
.hero h1{
  font-size:46px;
  line-height:1.2;
  font-weight:900;
  color:#fff;
  letter-spacing:-.02em;
}
.hero h1 span{
  background:linear-gradient(135deg, #fff 30%, var(--cyan) 100%);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}
.hero p{
  font-size:18px;
  color:var(--mut);
  margin-top:18px;
  max-width:640px;
  line-height:1.7;
}
.hero .btns{display:flex;gap:16px;margin-top:32px;flex-wrap:wrap}
.btn{
  background:linear-gradient(135deg,var(--cyan),#00b4d8);
  color:#070b14;
  padding:14px 28px;
  border-radius:10px;
  font-weight:800;
  font-size:15px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  box-shadow:0 6px 20px rgba(0,229,255,0.3);
  transition:.2s;
}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,229,255,0.45)}
.btn.wa-btn{
  background:linear-gradient(135deg,var(--wa),var(--wa-dark));
  color:#fff;
  box-shadow:0 6px 20px rgba(37,211,102,0.35);
}
.btn.wa-btn:hover{box-shadow:0 8px 25px rgba(37,211,102,0.5)}
.btn.ghost{
  background:rgba(255,255,255,0.06);
  color:#fff;
  border:1px solid var(--line-light);
  backdrop-filter:blur(8px);
}
.btn.ghost:hover{background:rgba(255,255,255,0.12);border-color:var(--cyan)}

/* Value Props */
.props{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:16px;
  margin-top:-44px;
  position:relative;
  z-index:2;
}
.prop{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:14px;
  padding:20px 22px;
  box-shadow:0 10px 30px rgba(0,0,0,0.4);
  transition:.2s;
}
.prop:hover{border-color:var(--cyan);transform:translateY(-3px)}
.prop .ico{font-size:28px;margin-bottom:8px}
.prop b{display:block;font-size:16px;color:#fff}
.prop span{color:var(--mut);font-size:13.5px;line-height:1.5;display:block;margin-top:4px}

/* Sections */
section{padding:60px 0 0}
.head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px}
.head h2{font-size:26px;font-weight:800;color:#fff;display:flex;align-items:center;gap:10px}
.head h2 span{color:var(--cyan)}
.head a{color:var(--cyan);font-size:14.5px;font-weight:600;transition:.2s}
.head a:hover{text-decoration:underline}

/* Rooms & Showcase Cards Grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:24px}
.card{
  background:var(--surface-card);
  border:1px solid var(--line-light);
  border-radius:16px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  transition:.25s ease;
  position:relative;
}
.card:hover{
  border-color:var(--cyan);
  transform:translateY(-4px);
  box-shadow:0 12px 30px rgba(0,229,255,0.15);
}
.card .img-wrap{
  width:100%;
  aspect-ratio:16/10;
  overflow:hidden;
  position:relative;
  background:#050811;
}
.card .img-wrap img{
  width:100%;
  height:100%;
  object-fit:cover;
  transition:.4s ease;
}
.card:hover .img-wrap img{transform:scale(1.05)}
.card .tag-overlay{
  position:absolute;
  top:14px;
  right:14px;
  background:rgba(7,11,20,0.85);
  backdrop-filter:blur(8px);
  border:1px solid var(--cyan);
  color:var(--cyan);
  font-size:12px;
  font-weight:700;
  padding:4px 10px;
  border-radius:99px;
}
.card .body{padding:20px;display:flex;flex-direction:column;flex:1}
.card .category{color:var(--cyan);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.card .name{font-weight:800;font-size:18px;color:#fff;margin-top:4px}
.card .meta{color:var(--mut);font-size:13.5px;margin-top:6px}
.card .foot{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:auto;
  padding-top:16px;
  border-top:1px solid rgba(255,255,255,0.08);
}
.card .price-box{display:flex;flex-direction:column}
.card .price-label{font-size:11.5px;color:var(--mut)}
.card .price{font-weight:900;font-size:22px;color:var(--cyan)}
.card .card-btns{display:flex;gap:8px}
.card .btn-wa{
  background:linear-gradient(135deg,var(--wa),var(--wa-dark));
  color:#fff;
  font-size:13px;
  font-weight:700;
  padding:9px 14px;
  border-radius:8px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  transition:.2s;
}
.card .btn-wa:hover{box-shadow:0 4px 14px rgba(37,211,102,0.4)}
.card .btn-view{
  background:rgba(255,255,255,0.06);
  color:#fff;
  border:1px solid var(--line-light);
  font-size:13px;
  font-weight:600;
  padding:9px 12px;
  border-radius:8px;
  transition:.2s;
}
.card .btn-view:hover{border-color:var(--cyan);color:var(--cyan)}

/* Lunar Feature Banner */
.lunar-banner{
  background:linear-gradient(135deg, #0c182c 0%, #08101e 100%);
  border:1px solid var(--cyan);
  border-radius:20px;
  overflow:hidden;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:32px;
  align-items:center;
  box-shadow:0 16px 40px rgba(0,229,255,0.12);
  margin-top:30px;
}
@media(max-width:860px){.lunar-banner{grid-template-columns:1fr}}
.lunar-img{width:100%;height:100%;min-height:360px;object-fit:cover}
.lunar-info{padding:36px}
.lunar-tag{
  display:inline-block;
  background:rgba(255,209,102,0.15);
  border:1px solid var(--gold);
  color:var(--gold);
  font-size:12px;
  font-weight:800;
  padding:5px 12px;
  border-radius:99px;
  margin-bottom:12px;
}
.lunar-info h3{font-size:28px;font-weight:900;color:#fff;line-height:1.25}
.lunar-info p{color:var(--mut);font-size:15px;margin-top:12px;line-height:1.7}
.lunar-specs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
.lunar-spec{background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)}
.lunar-spec b{color:#fff;font-size:13.5px;display:block}
.lunar-spec span{color:var(--cyan);font-size:12.5px}
.lunar-cta{display:flex;align-items:center;gap:16px;margin-top:24px}
.lunar-price{font-size:28px;font-weight:900;color:var(--cyan)}

/* Categories bar */
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.cat{
  background:var(--surface);
  border:1px solid var(--line-light);
  border-radius:12px;
  padding:16px;
  text-align:center;
  transition:.2s;
}
.cat:hover{border-color:var(--cyan);transform:translateY(-2px);background:var(--surface-card)}
.cat .ico{font-size:32px}
.cat .nm{font-weight:700;font-size:14px;color:#fff;margin-top:6px}
.cat .ct{color:var(--mut);font-size:12px}

/* Detail page */
.crumb{color:var(--mut);font-size:14px;padding:26px 0 0}
.crumb a:hover{color:var(--cyan)}
.detail{
  display:grid;
  grid-template-columns:1.1fr .9fr;
  gap:36px;
  align-items:start;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:18px;
  padding:34px;
  margin-top:16px;
}
@media(max-width:800px){.detail{grid-template-columns:1fr}}
.detail-img-box{
  width:100%;
  aspect-ratio:16/10;
  border-radius:14px;
  overflow:hidden;
  border:1px solid var(--line);
  box-shadow:0 10px 30px rgba(0,0,0,0.5);
}
.detail-img-box img{width:100%;height:100%;object-fit:cover}
.detail h1{font-size:30px;font-weight:900;color:#fff;line-height:1.25}
.detail .sub{color:var(--cyan);font-size:15px;font-weight:600;margin-top:4px}
.detail .big{font-size:36px;font-weight:900;color:var(--cyan);margin-top:16px}
table{width:100%;border-collapse:collapse;margin-top:20px}
td{padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:15px}
td:first-child{color:var(--mut);width:140px}
.buy{
  display:inline-flex;
  align-items:center;
  gap:10px;
  margin-top:24px;
  background:linear-gradient(135deg,var(--wa),var(--wa-dark));
  color:#fff;
  padding:15px 32px;
  border-radius:10px;
  font-weight:800;
  font-size:16px;
  box-shadow:0 6px 20px rgba(37,211,102,0.35);
  transition:.2s;
}
.buy:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(37,211,102,0.5)}

/* Info page */
.info{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:18px;
  padding:36px;
  margin-top:16px;
  white-space:pre-wrap;
  font-size:16px;
  line-height:1.8;
}

/* Floating WhatsApp button */
.wa-float{
  position:fixed;
  bottom:26px;
  left:26px;
  z-index:999;
  display:flex;
  align-items:center;
  gap:12px;
  background:linear-gradient(135deg,#25d366,#128c7e);
  color:#fff;
  padding:13px 22px;
  border-radius:99px;
  font-weight:800;
  font-size:15px;
  box-shadow:0 8px 25px rgba(37,211,102,0.45);
  border:2px solid rgba(255,255,255,0.25);
  transition:.25s ease;
  cursor:pointer;
}
.wa-float:hover{
  transform:scale(1.05) translateY(-2px);
  box-shadow:0 12px 30px rgba(37,211,102,0.65);
}
.wa-float svg{width:24px;height:24px;fill:currentColor}

/* Footer */
footer{
  background:#04070d;
  border-top:1px solid rgba(255,255,255,0.08);
  color:var(--mut);
  margin-top:80px;
  padding:50px 0 30px;
  font-size:14.5px;
}
footer .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px}
footer b{color:#fff;display:block;margin-bottom:12px;font-size:16px}
footer a{transition:.2s}
footer a:hover{color:var(--cyan)}
footer .bot{border-top:1px solid rgba(255,255,255,0.06);margin-top:36px;padding-top:20px;text-align:center;font-size:13px}
@media(max-width:640px){
  .hero h1{font-size:32px}
  nav .links{display:none}
  .grid{grid-template-columns:1fr}
  .wa-float span{display:none}
  .wa-float{padding:14px;border-radius:50%}
}
`;

function shell(title, body, { hero = '' } = {}) {
  const hotelName = esc(config.business.name || 'מלון וויזארד ריזורט & ספא');
  const waUrl = getWhatsAppUrl();

  const waIcon = `<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.05 6.94C8.84 6.94 8.5 7.02 8.2 7.34C7.91 7.66 7.08 8.44 7.08 10.02C7.08 11.6 8.23 13.12 8.39 13.33C8.55 13.54 10.63 16.74 13.82 18.12C14.58 18.45 15.17 18.65 15.63 18.8C16.39 19.04 17.08 19 17.63 18.92C18.24 18.83 19.52 18.15 19.78 17.41C20.05 16.67 20.05 16.04 19.97 15.91C19.89 15.78 19.68 15.7 19.37 15.54C19.06 15.38 17.5 14.61 17.21 14.51C16.92 14.41 16.71 14.36 16.5 14.67C16.29 14.99 15.7 15.7 15.52 15.91C15.34 16.12 15.16 16.15 14.85 15.99C14.54 15.83 13.54 15.5 12.35 14.44C11.42 13.61 10.79 12.59 10.61 12.28C10.43 11.96 10.59 11.79 10.75 11.63C10.89 11.49 11.06 11.26 11.22 11.08C11.38 10.9 11.43 10.77 11.53 10.56C11.64 10.35 11.59 10.17 11.51 10.01C11.43 9.85 10.81 8.32 10.55 7.7C10.3 7.09 10.05 7.18 9.86 7.17C9.68 7.16 9.47 7.16 9.26 7.16L9.05 6.94Z"/></svg>`;

  return `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<nav><div class="wrap">
  <a class="logo" href="/"><span>✦</span> ${hotelName}</a>
  <div class="links">
    <a href="/">בית</a>
    <a href="/catalog">חדרים וסוויטות</a>
    <a href="/c/${encodeURIComponent('אטרקציות וטיולים')}">טיולים לירח</a>
    <a href="/c/${encodeURIComponent('ספא ורווחה')}">ספא קוונטי</a>
    <a href="/info">מידע ושירותים</a>
  </div>
  <a class="cta" href="${waUrl}" target="_blank" rel="noopener noreferrer">${waIcon} הזמנות בוואטסאפ</a>
</div></nav>
${hero}
<div class="wrap">${body}</div>

<!-- Floating WhatsApp Action -->
<a class="wa-float" href="${waUrl}" target="_blank" rel="noopener noreferrer" title="שוחחו עם קונסיירז' המלון בוואטסאפ">
  ${waIcon}
  <span>צ'אט עם קונסיירז' המלון</span>
</a>

<footer><div class="wrap">
  <div class="cols">
    <div>
      <b>${hotelName}</b>
      ריזורט נופש עתידני פורץ דרך המשלב אירוח יוקרתי, חדרים חכמים באפס כבידה וחוויות חלל ייחודיות.
    </div>
    <div>
      <b>אירוח וחוויות</b>
      <a href="/catalog">חמשת סוגי החדרים והסוויטות</a><br>
      <a href="/c/${encodeURIComponent('אטרקציות וטיולים')}">טיולים מודרכים לירח</a><br>
      <a href="/c/${encodeURIComponent('ספא ורווחה')}">מתחם הספא והבריכות</a>
    </div>
    <div>
      <b>שירות והזמנות 24/7</b>
      מענה מיידי בוואטסאפ מסביב לשעון<br>
      טלפון קבלה: ${esc(config.business.ownerPhone || '03-5551234')}<br>
      מנהל שירות: ${esc(config.business.ownerName || 'דני ברקאי')}
    </div>
  </div>
  <div class="bot">© ${new Date().getFullYear()} ${hotelName} · כל הזכויות שמורות</div>
</div></footer>
</body></html>`;
}

function card(r) {
  const ok = inStock(r);
  const imgUrl = getItemImage(r);
  const waUrl = getWhatsAppUrl(`שלום, אני מעוניין להזמין את ${r['שם המוצר']} (${r['מחיר']} ₪)`);

  return `<div class="card">
  <div class="img-wrap">
    <img src="${imgUrl}" alt="${esc(r['שם המוצר'])}" loading="lazy">
    <div class="tag-overlay">${esc(r['קטגוריה'] || 'חדר')}</div>
  </div>
  <div class="body">
    <div class="category">${esc(r['מותג'] || 'Hotel Wizard')}</div>
    <div class="name">${esc(r['שם המוצר'])}</div>
    <div class="meta">${esc(r['גודל'])}${r['מתאים ל'] ? ' · ' + esc(r['מתאים ל']) : ''}</div>
    <div class="foot">
      <div class="price-box">
        <span class="price-label">מחיר ללילה / חוויה</span>
        <span class="price">${esc(r['מחיר'])} ₪</span>
      </div>
      <div class="card-btns">
        <a class="btn-view" href="/p/${esc(r['מקט'])}">פרטים</a>
        <a class="btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer">הזמן בוואטסאפ</a>
      </div>
    </div>
  </div>
</div>`;
}

function groupByCategory(rows) {
  const m = new Map();
  for (const r of rows) {
    const c = r['קטגוריה'] || 'שונות';
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(r);
  }
  return m;
}

export async function homePage() {
  const rows = await getSheetRows(config.data.inventorySheetId);
  const cats = groupByCategory(rows);
  const waUrl = getWhatsAppUrl();

  const hero = `<div class="hero"><div class="wrap"><div class="hero-content">
  <div class="badge-hero">✦ הדור הבא של עולם המלונאות והנופש</div>
  <h1><span>מלון וויזארד ריזורט & ספא</span><br>חוויית אירוח עתידנית שטרם הכרתם</h1>
  <p>500 חדרים וסוויטות חכמות, מיטות ריחוף באפס כבידה (Zero-G), קירות הולוגרפיים, טיולים מודרכים לירח, קולינריה מולקולרית וספא תדרי קול.</p>
  <div class="btns">
    <a class="btn wa-btn" href="${waUrl}" target="_blank" rel="noopener noreferrer">
      בדקו זמינות בוואטסאפ
    </a>
    <a class="btn ghost" href="/catalog">גלו את כל החדרים</a>
  </div>
</div></div></div>`;

  // 5 futuristic rooms showcase
  const rooms = rows.filter((r) => r['קטגוריה']?.includes('חדרים') || r['קטגוריה']?.includes('סוויטות')).slice(0, 5);

  const body = `
<div class="props">
  <div class="prop">
    <div class="ico">🌕</div>
    <b>טיולים מודרכים לירח</b>
    <span>טיסה ברחפת חלל, הליכת ירח עם מדריך מוסמך וארוחה מולקולרית</span>
  </div>
  <div class="prop">
    <div class="ico">🛏️</div>
    <b>שינה באפס כבידה</b>
    <span>מיטות ריחוף מגנטיות Zero-G וקירות הולוגרפיים אינטראקטיביים</span>
  </div>
  <div class="prop">
    <div class="ico">🛸</div>
    <b>שאטל רחפנים VIP</b>
    <span>הסעות אוטונומיות מהירות מנמל התעופה ונמל החלל ישירות למלון</span>
  </div>
  <div class="prop">
    <div class="ico">🧖</div>
    <b>ספא קוונטי ותאי חמצן</b>
    <span>הידרותרפיה ביו-סונית, עיסויי תדרי רטט ומתחמי התחדשות תאיים</span>
  </div>
</div>

<!-- 5 Futuristic Rooms Section -->
<section id="rooms">
  <div class="head">
    <h2><span>✦</span> 5 סוגי החדרים והסוויטות העתידניים</h2>
    <a href="/catalog">לכל החדרים והשירותים ←</a>
  </div>
  <div class="grid">${rooms.map(card).join('')}</div>
</section>

<!-- Guided Lunar Excursion Feature Banner -->
<section>
  <div class="lunar-banner">
    <img class="lunar-img" src="/images/lunar_excursion.jpg" alt="טיול מודרך לירח" loading="lazy">
    <div class="lunar-info">
      <div class="lunar-tag">חוויית החלל הבלעדית של וויזארד ריזורט</div>
      <h3>טיול מודרך אקסקלוסיבי לירח</h3>
      <p>חוויה על-זמנית של פעם בחיים: שיגור ברחפת החלל Lunar Shuttle אל בסיס המחקר הירחי, הליכת ירח מודרכת בחליפות אסטרונאוטים יוקרתיות ותצפית מרהיבה על כדור הארץ.</p>
      <div class="lunar-specs">
        <div class="lunar-spec"><b>משך הסיור</b><span>4 שעות בחלל</span></div>
        <div class="lunar-spec"><b>ליווי</b><span>אסטרונאוט מוסמך צמוד</span></div>
        <div class="lunar-spec"><b>כולל</b><span>חליפת חלל וארוחה מולקולרית</span></div>
        <div class="lunar-spec"><b>יציאה</b><span>ממנחת החלל של המלון</span></div>
      </div>
      <div class="lunar-cta">
        <div class="lunar-price">8,500 ₪</div>
        <a class="btn wa-btn" href="${getWhatsAppUrl('שלום, אני מתעניין בטיול מודרך לירח של מלון וויזארד')}" target="_blank" rel="noopener noreferrer">
          שריין מקום בוואטסאפ
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Categories section -->
<section>
  <div class="head"><h2><span>✦</span> קטגוריות וחוויות במלון</h2></div>
  <div class="cats">${[...cats.entries()]
    .map(
      ([c, items]) => `<a class="cat" href="${catUrl(c)}">
        <div class="ico">${CAT_ICON[c] || '✦'}</div>
        <div class="nm">${esc(c)}</div>
        <div class="ct">${items.length} אפשרויות</div>
      </a>`
    )
    .join('')}</div>
</section>

<!-- Personal Concierge WhatsApp CTA -->
<section style="margin-bottom:20px">
  <div class="prop" style="padding:36px;border-color:var(--cyan);background:linear-gradient(135deg,var(--surface-card),var(--surface))">
    <b style="font-size:20px;color:#fff">מתלבטים באיזה חדר לבחור או מעוניינים לתאם טיול ירח?</b>
    <span style="font-size:15px;margin-top:8px">קונסיירז' ה-AI של מלון וויזארד זמין עבורכם 24/7 בוואטסאפ לכל שאלה, בדיקת תאריכים והזמנות מותאמות אישית.</span>
    <div style="margin-top:20px">
      <a class="buy" style="margin:0" href="${waUrl}" target="_blank" rel="noopener noreferrer">
        פתחו שיחה עם קונסיירז' המלון
      </a>
    </div>
  </div>
</section>`;

  return shell(config.business.name || 'מלון וויזארד ריזורט & ספא', body, { hero });
}

export async function catalogPage() {
  const rows = await getSheetRows(config.data.inventorySheetId);
  const cats = groupByCategory(rows);
  const body = `<div class="crumb"><a href="/">בית</a> › חדרים, סוויטות וחוויות</div>
${[...cats.entries()]
    .map(
      ([c, items]) => `<section><div class="head">
<h2>${CAT_ICON[c] || '✦'} ${esc(c)}</h2><a href="${catUrl(c)}">צפה בכל ה-${items.length} ←</a></div>
<div class="grid">${items.map(card).join('')}</div></section>`
    )
    .join('')}`;
  return shell(`חדרים וחוויות · ${config.business.name}`, body);
}

export async function categoryPage(name) {
  const rows = await getSheetRows(config.data.inventorySheetId);
  const items = rows.filter((r) => (r['קטגוריה'] || '') === name);
  if (!items.length) return null;
  const body = `<div class="crumb"><a href="/">בית</a> › <a href="/catalog">כל החוויות</a> › ${esc(name)}</div>
<section style="padding-top:20px"><div class="head">
<h2>${CAT_ICON[name] || '✦'} ${esc(name)}</h2><span style="color:var(--mut);font-size:14px">${items.length} תוצאות</span></div>
<div class="grid">${items.map(card).join('')}</div></section>`;
  return shell(`${name} · ${config.business.name}`, body);
}

export async function productPage(sku) {
  const rows = await getSheetRows(config.data.inventorySheetId);
  const r = rows.find((x) => String(x['מקט']) === String(sku));
  if (!r) return null;

  const ok = inStock(r);
  const cat = r['קטגוריה'] || '';
  const imgUrl = getItemImage(r);
  const related = rows.filter((x) => x['קטגוריה'] === cat && x['מקט'] !== r['מקט']).slice(0, 3);
  const waUrl = getWhatsAppUrl(`שלום, אני מעוניין בפרטים והזמנה של ${r['שם המוצר']} (${r['מחיר']} ₪)`);

  const fields = ['מותג', 'קטגוריה', 'מתאים ל', 'גודל', 'מקט', 'ימי אספקה']
    .filter((k) => r[k])
    .map((k) => `<tr><td>${esc(k)}</td><td>${esc(r[k])}</td></tr>`)
    .join('');

  const body = `<div class="crumb"><a href="/">בית</a> › <a href="/catalog">כל החדרים</a> › <a href="${catUrl(cat)}">${esc(cat)}</a></div>
<div class="detail">
  <div class="detail-img-box">
    <img src="${imgUrl}" alt="${esc(r['שם המוצר'])}">
  </div>
  <div>
    <h1>${esc(r['שם המוצר'])}</h1>
    <div class="sub">${esc(r['מותג'] || 'Hotel Wizard Resort')}${r['מתאים ל'] ? ' · ' + esc(r['מתאים ל']) : ''}</div>
    <div class="big">${esc(r['מחיר'])} ₪</div>
    <p style="margin-top:10px">
      <span style="background:rgba(0,229,255,0.15);color:var(--cyan);border:1px solid var(--cyan);padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700">
        ${ok ? 'זמין להזמנה מיידית' : 'בתיאום מראש'}
      </span>
    </p>
    <table>${fields}</table>
    <a class="buy" href="${waUrl}" target="_blank" rel="noopener noreferrer">
      שריין מקום בוואטסאפ
    </a>
  </div>
</div>
${related.length ? `<section><div class="head"><h2>אפשרויות נוספות ב${esc(cat)}</h2><a href="${catUrl(cat)}">הכל ←</a></div><div class="grid">${related.map(card).join('')}</div></section>` : ''}`;

  return shell(`${r['שם המוצר']} · ${config.business.name}`, body);
}

export async function infoPage() {
  const text = await getKnowledgeText();
  const body = `<div class="crumb"><a href="/">בית</a> › מידע ושירותי המלון</div>
<div class="info">${esc(text)}</div>`;
  return shell(`מידע ושירותים · ${config.business.name}`, body);
}
