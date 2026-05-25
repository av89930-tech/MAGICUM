const { getStore } = require('@netlify/blobs');

const SITE = 'https://magicum.netlify.app';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
}

exports.handler = async (event, context) => {
  const slug = (event.queryStringParameters || {}).slug || '';

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { statusCode: 302, headers: { Location: '/gallery' } };
  }

  try {
    const store = getStore({ name: 'magicum', context });
    const raw = await store.get(`case:${slug}`);

    if (!raw) {
      return { statusCode: 302, headers: { Location: '/gallery' } };
    }

    const c = JSON.parse(raw);
    const imageUrl = `${SITE}/case-image?slug=${slug}`;
    const canonicalUrl = `${SITE}/case/${slug}`;
    const createdDate = formatDate(c.createdAt);

    const jsonLD = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      name: c.title,
      description: c.description,
      contentUrl: imageUrl,
      url: canonicalUrl,
      datePublished: c.createdAt,
      author: { '@type': 'Organization', name: 'MAGICUM Atelier', url: SITE }
    });

    const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(c.title)} | MAGICUM</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.description)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="MAGICUM Atelier">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(c.title)}">
<meta name="twitter:description" content="${esc(c.description)}">
<meta name="twitter:image" content="${imageUrl}">
<script type="application/ld+json">${jsonLD}</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✨</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@200;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--gold:#C9A96E;--dark:#0A0A08;--dark-card:#0D0D0B;--border-dim:#1F1F1C;--text-light:#D1CDC7}
body{font-family:'Jost',sans-serif;background:var(--dark);color:var(--text-light);min-height:100vh}
nav{padding:24px 40px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-dim)}
.logo{color:var(--gold);font-size:1.2rem;letter-spacing:10px;text-transform:uppercase;font-weight:300;text-decoration:none}
.logo b{font-weight:700}
.nav-link{color:var(--text-light);text-decoration:none;font-size:0.65rem;letter-spacing:3px;opacity:0.5;transition:opacity .3s}
.nav-link:hover{opacity:1}
.main{max-width:900px;margin:0 auto;padding:60px 20px 120px}
h1{font-size:1.4rem;font-weight:300;letter-spacing:4px;margin-bottom:8px;color:var(--gold)}
.meta{font-size:0.6rem;letter-spacing:2px;opacity:0.4;margin-bottom:48px}
.slider-compare{position:relative;width:100%;overflow:hidden;border:1px solid var(--gold);border-radius:8px;background:#000;user-select:none;cursor:ew-resize}
.slider-img{width:100%;display:block;pointer-events:none}
.slider-overlay{position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden}
.slider-overlay img{width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;pointer-events:none}
.slider-handle{position:absolute;top:0;bottom:0;width:2px;background:var(--gold);cursor:ew-resize;z-index:15;box-shadow:0 0 10px var(--gold)}
.slider-handle::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:38px;height:38px;background:#0D0D0B;border:1.5px solid var(--gold);border-radius:50%}
.hint{text-align:center;font-size:0.6rem;margin-top:12px;opacity:0.5;letter-spacing:2px}
.details{display:flex;gap:32px;flex-wrap:wrap;margin:40px 0;padding:24px;background:var(--dark-card);border:1px solid var(--border-dim);border-radius:4px}
.detail{flex:1;min-width:120px}
.detail-label{font-size:0.55rem;letter-spacing:3px;opacity:0.4;margin-bottom:6px;text-transform:uppercase}
.detail-value{font-size:0.85rem;color:var(--gold)}
.cta{text-align:center;padding:48px 0}
.btn{display:inline-block;border:1.5px solid var(--gold);color:var(--gold);padding:14px 42px;font-size:0.8rem;letter-spacing:5px;text-decoration:none;text-transform:uppercase;transition:.4s}
.btn:hover{background:var(--gold);color:var(--dark)}
footer{text-align:center;padding:40px 20px;font-size:0.6rem;letter-spacing:4px;opacity:0.3}
@media(max-width:600px){nav{padding:16px 20px}.main{padding:40px 16px 80px}.details{gap:20px}}
</style>
</head>
<body>
<nav>
  <a href="/" class="logo">MAGIC<b>UM</b></a>
  <a href="/gallery" class="nav-link">← ГАЛЕРЕЯ</a>
</nav>
<main class="main">
  <h1>${esc(c.title)}</h1>
  <p class="meta">${createdDate}${c.city ? ` · ${esc(c.city)}` : ''}</p>
  <div class="slider-compare" id="sc">
    <img id="before" class="slider-img" src="data:image/jpeg;base64,${c.beforeB64}" alt="до переобивки — ${esc(c.furnitureType)}">
    <div class="slider-overlay" id="so">
      <img src="data:image/jpeg;base64,${c.afterB64}" alt="після переобивки — ${esc(c.fabricName)}">
    </div>
    <div class="slider-handle" id="sh"></div>
  </div>
  <p class="hint">⇠ перетягніть: до &nbsp;|&nbsp; після ⇢</p>
  <div class="details">
    <div class="detail"><div class="detail-label">Меблі</div><div class="detail-value">${esc(c.furnitureType)}</div></div>
    <div class="detail"><div class="detail-label">Тканина</div><div class="detail-value">${esc(c.fabricName)}</div></div>
    ${c.city ? `<div class="detail"><div class="detail-label">Місто</div><div class="detail-value">${esc(c.city)}</div></div>` : ''}
    <div class="detail"><div class="detail-label">Дата</div><div class="detail-value">${createdDate}</div></div>
  </div>
  <div class="cta">
    <p style="font-size:0.65rem;letter-spacing:3px;opacity:0.5;margin-bottom:20px">ХОЧЕТЕ ТАК САМО?</p>
    <a href="/" class="btn">СПРОБУВАТИ БЕЗКОШТОВНО</a>
  </div>
</main>
<footer>M M X X V I | MAGICUM ATELIER | ART OF TRANSFORMATION</footer>
<script>
(function(){
  var c=document.getElementById('sc'),o=document.getElementById('so'),h=document.getElementById('sh'),drag=false;
  function update(x){var r=c.getBoundingClientRect(),p=Math.min(Math.max((x-r.left)/r.width*100,0),100);h.style.left=p+'%';o.style.clipPath='inset(0 '+(100-p)+'% 0 0)'}
  h.addEventListener('mousedown',function(){drag=true});
  window.addEventListener('mouseup',function(){drag=false});
  window.addEventListener('mousemove',function(e){if(drag)update(e.clientX)});
  h.addEventListener('touchstart',function(){drag=true},{passive:true});
  window.addEventListener('touchend',function(){drag=false});
  window.addEventListener('touchmove',function(e){if(drag&&e.touches[0])update(e.touches[0].clientX)},{passive:true});
  h.style.left='50%';o.style.clipPath='inset(0 50% 0 0)';
})();
</script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: html
    };
  } catch (err) {
    console.error('case render error:', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
