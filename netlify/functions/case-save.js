const { getStore } = require('@netlify/blobs');

function blobStore(context) {
  const opts = { name: 'magicum', context };
  if (process.env.NETLIFY_SITE_ID)    opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_BLOBS_TOKEN) opts.token  = process.env.NETLIFY_BLOBS_TOKEN;
  return getStore(opts);
}

const TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'h','д':'d','е':'e','є':'ie','ж':'zh','з':'z',
  'и':'y','і':'i','ї':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
  'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch',
  'ш':'sh','щ':'shch','ь':'','ю':'iu','я':'ia'
};

function toSlug(str) {
  return str.toLowerCase()
    .split('')
    .map(c => TRANSLIT[c] !== undefined ? TRANSLIT[c] : (/[a-z0-9]/.test(c) ? c : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidBase64(str) {
  return typeof str === 'string' && str.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(str);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             event.headers['client-ip'] || 'unknown';
  const today = new Date().toISOString().slice(0, 10);

  try {
    const store = blobStore(context);

    // Rate limit: max 10 saves per IP per day
    const rlKey = `ratelimit:${ip}:${today}`;
    const rlRaw = await store.get(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;
    if (rlCount >= 10) {
      return { statusCode: 429, body: JSON.stringify({ success: false, error: 'Занадто багато запитів. Спробуйте завтра.' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { furnitureType, fabricName, city, beforeB64, afterB64 } = body;

    if (!furnitureType || !fabricName || !beforeB64 || !afterB64) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Відсутні обовʼязкові поля' }) };
    }
    if (furnitureType.length > 50 || fabricName.length > 50 || (city && city.length > 50)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Поле занадто довге' }) };
    }
    if (!isValidBase64(beforeB64) || !isValidBase64(afterB64)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Невалідні дані зображення' }) };
    }
    const MAX_IMAGE_B64 = 500 * 1024; // 500 KB (~375 KB raw)
    if (beforeB64.length > MAX_IMAGE_B64 || afterB64.length > MAX_IMAGE_B64) {
      return { statusCode: 413, body: JSON.stringify({ success: false, error: 'Зображення занадто велике. Максимум 500 КБ.' }) };
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const baseSlug = `${toSlug(furnitureType)}-${toSlug(fabricName)}-${dateStr}`;

    // Ensure uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (await store.get(`case:${slug}`)) {
      slug = `${baseSlug}-${++counter}`;
    }

    const cityStr = city ? city.trim() : '';
    const title = `Переобивка ${furnitureType}: ${fabricName}${cityStr ? ` · ${cityStr}` : ''}`;
    const description = `AI-візуалізація переобивки ${furnitureType} тканиною ${fabricName}${cityStr ? ` у ${cityStr}` : ''}. Результат до та після — дивіться на MAGICUM.`;

    const caseData = {
      slug, title, description, furnitureType, fabricName,
      city: cityStr, beforeB64, afterB64, createdAt: now.toISOString()
    };

    await store.set(`case:${slug}`, JSON.stringify(caseData));

    // Update index list (newest first, max 1000 entries)
    const indexRaw = await store.get('index:all');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift({ slug, title, furnitureType, fabricName, city: cityStr, createdAt: now.toISOString() });
    if (index.length > 1000) index.splice(1000);
    await store.set('index:all', JSON.stringify(index));

    await store.set(rlKey, String(rlCount + 1));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, slug, url: `/case/${slug}` })
    };
  } catch (err) {
    console.error('case-save error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
