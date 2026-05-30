// ── MAGICUM · case-view.js ──────────────────────────────────────────────────
// Returns HTML page for a saved visualization case
// ---------------------------------------------------------------------------

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const id = event.path.replace(/^\/case\//, '').replace(/^\/\.netlify\/functions\/case-view\/?/, '');

  if (!id) {
    return { statusCode: 400, body: 'Missing case ID' };
  }

  let caseData;
  try {
    const store = getStore({
      name: 'cases',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    caseData = await store.get(id, { type: 'json' });
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }

  if (!caseData) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: '<h1>Кейс не знайдено</h1>' };
  }

  const { furnitureType, fabricName, city, createdAt, beforeB64, afterB64 } = caseData;
  const date = new Date(createdAt).toLocaleDateString('uk-UA');
  const subtitle = [furnitureType, fabricName, city].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MAGICUM — ${subtitle || 'Кейс переобивки'}</title>
<meta property="og:title" content="MAGICUM — ${subtitle}">
<meta property="og:description" content="AI-візуалізація переобивки меблів">
<meta property="og:image" content="data:image/jpeg;base64,${afterB64}">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--gold:#c9a84c;--bg:#0e0e0e;--card:#161616;--border:rgba(201,168,76,0.2);--text:#f0ead8;--muted:#8a8070}
body{background:var(--bg);color:var(--text);font-family:'Montserrat',sans-serif;font-weight:300;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px}
.logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--gold);letter-spacing:6px;margin-bottom:4px}
.date{font-size:10px;color:var(--muted);letter-spacing:2px;margin-bottom:24px}
.subtitle{font-size:11px;color:var(--gold);letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;text-align:center}
.images{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:800px}
@media(max-width:500px){.images{grid-template-columns:1fr}}
.img-wrap{position:relative}
.img-label{font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:6px}
.img-wrap img{width:100%;border:1px solid var(--border);display:block}
.cta{margin-top:32px;font-size:11px;color:var(--muted);letter-spacing:2px;text-align:center}
.cta a{color:var(--gold);text-decoration:none}
.divider{width:60px;height:1px;background:linear-gradient(to right,transparent,var(--gold),transparent);margin:16px auto}
</style>
</head>
<body>
<div class="logo">MAGICUM</div>
<div class="date">${date}</div>
${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
<div class="divider"></div>
<div class="images">
  <div class="img-wrap">
    <div class="img-label">До</div>
    <img src="data:image/jpeg;base64,${beforeB64}" alt="До переобивки">
  </div>
  <div class="img-wrap">
    <div class="img-label">Після</div>
    <img src="data:image/jpeg;base64,${afterB64}" alt="Після переобивки">
  </div>
</div>
<div class="cta">
  <div class="divider"></div>
  Створено за допомогою <a href="https://magicum.netlify.app">MAGICUM</a>
</div>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};
