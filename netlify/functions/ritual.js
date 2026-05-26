const { getStore } = require('@netlify/blobs');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
];

function getRegistry() {
  const raw = process.env.KEY_REGISTRY;
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  catch(e) { return null; }
}

function usageStore(context) {
  const opts = { name: 'key-usage', context };
  if (process.env.NETLIFY_SITE_ID)     opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_BLOBS_TOKEN) opts.token  = process.env.NETLIFY_BLOBS_TOKEN;
  return getStore(opts);
}

const FREE_GOOGLE_LIMIT = 10;
const FREE_ANON_LIMIT   = 3;

async function checkAndConsumeKey(key, context, ip) {
  const registry    = getRegistry();
  const netlifyUser = context.clientContext?.user;

  // ── Tier 1: no KEY_REGISTRY configured → open access ──
  if (!registry) return { ok: true };

  // ── Tier 2: Master key ──
  if (key) {
    const entry = registry[key.trim().toUpperCase()];
    if (!entry) return { ok: false, error: 'Ключ недійсний' };
    if (entry.limit === null) return { ok: true, unlimited: true }; // Ключ Одіна
    const store   = usageStore(context);
    const blobKey = 'key_' + key.trim().toUpperCase();
    const usedRaw = await store.get(blobKey).catch(() => null);
    const used    = usedRaw ? parseInt(usedRaw, 10) : 0;
    if (used >= entry.limit) return { ok: false, error: `Ліміт вичерпано (${entry.limit}/${entry.limit})` };
    await store.set(blobKey, String(used + 1));
    return { ok: true, remaining: entry.limit - used - 1 };
  }

  // ── Tier 3: Google / Netlify Identity ──
  if (netlifyUser?.email) {
    const store   = usageStore(context);
    const blobKey = 'google_' + netlifyUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const usedRaw = await store.get(blobKey).catch(() => null);
    const used    = usedRaw ? parseInt(usedRaw, 10) : 0;
    if (used >= FREE_GOOGLE_LIMIT) {
      return { ok: false, error: `Вичерпано ${FREE_GOOGLE_LIMIT} безкоштовних візуалізацій. Отримайте Майстер-ключ.` };
    }
    await store.set(blobKey, String(used + 1));
    return { ok: true, remaining: FREE_GOOGLE_LIMIT - used - 1, tier: 'google' };
  }

  // ── Tier 4: No auth → Google login required ──
  return { ok: false, error: 'Для ритуалу необхідний вхід через Google' };
}

const OVERLOAD_CODES = new Set([429, 500, 503, 529]);

async function callGemini(model, requestBody, apiKey) {
  const response = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
  );
  let data;
  try { data = await response.json(); }
  catch (e) { data = { error: { message: `Non-JSON response from Gemini (${response.status})` } }; }
  return { ok: response.ok, status: response.status, data };
}

// Відправляє альбом із 3 фото (диван + тканина + результат) + підпис
async function tgSendRitual({ token, chatId, sofa64, sofaMime, fabric64, fabricMime, result64, resultMime, model, isFallback, ip, time }) {
  if (!token || !chatId) return;
  try {
    const modelLine = isFallback
      ? `⚡ Резерв: <code>${model}</code> (основна перевантажена)`
      : `✅ Модель: <code>${model}</code>`;

    const caption =
      `🔮 <b>MAGICUM — Ритуал завершено</b>\n` +
      `👤 ${ip}\n` +
      `${modelLine}\n` +
      `⏰ ${time}`;

    const media = JSON.stringify([
      { type: 'photo', media: 'attach://sofa',   caption: '🛋 Диван (вхід)' },
      { type: 'photo', media: 'attach://fabric', caption: '🧵 Тканина (вхід)' },
      { type: 'photo', media: 'attach://result', caption, parse_mode: 'HTML' },
    ]);

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('media', media);
    form.append('sofa',   new Blob([Buffer.from(sofa64,   'base64')], { type: sofaMime   || 'image/jpeg' }), 'sofa.jpg');
    form.append('fabric', new Blob([Buffer.from(fabric64, 'base64')], { type: fabricMime || 'image/jpeg' }), 'fabric.jpg');
    form.append('result', new Blob([Buffer.from(result64, 'base64')], { type: resultMime || 'image/jpeg' }), 'result.jpg');

    await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: form
    });
  } catch (e) {
    console.error('[tg] album error:', e.message);
  }
}

// 🚨 Тривожний алерт — сервер впав, надсилає фото клієнта для ручної обробки
async function tgSendFailAlert({ token, chatId, sofa64, sofaMime, fabric64, fabricMime, reason, ip, time }) {
  if (!token || !chatId) return;
  try {
    const caption =
      `🚨🚨🚨 <b>MAGICUM — СЕРВЕР ВПАВ!</b> 🚨🚨🚨\n` +
      `👤 ${ip}\n` +
      `❌ ${reason}\n` +
      `⏰ ${time}\n\n` +
      `📸 <b>Фото клієнта — обробіть ВРУЧНУ і відправте результат!</b>`;

    const media = JSON.stringify([
      { type: 'photo', media: 'attach://sofa',   caption: '🛋 Диван клієнта' },
      { type: 'photo', media: 'attach://fabric', caption, parse_mode: 'HTML' },
    ]);

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('media', media);
    form.append('sofa',   new Blob([Buffer.from(sofa64,   'base64')], { type: sofaMime   || 'image/jpeg' }), 'sofa.jpg');
    form.append('fabric', new Blob([Buffer.from(fabric64, 'base64')], { type: fabricMime || 'image/jpeg' }), 'fabric.jpg');

    await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, { method: 'POST', body: form });

    // Окреме голосове/аудіо повідомлення як сигнал тривоги
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🔔 УВАГА! Клієнт чекає — обробіть вручну!',
        parse_mode: 'HTML',
        disable_notification: false
      })
    });
  } catch(e) {
    console.error('[tg] fail alert error:', e.message);
  }
}

// Текстове сповіщення — для помилок
function tgNotifyError(token, chatId, text) {
  if (!token || !chatId) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  }).catch(() => {});
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const ip   = event.headers['x-nf-client-connection-ip']
            || event.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || 'невідомо';
  const time = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

  try {
    const { furnitureBase64, furnitureMime, fabricBase64, fabricMime, key } = JSON.parse(event.body || '{}');

    if (!furnitureBase64 || !fabricBase64) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing images' }) };
    }

    // Key validation + usage tracking
    const keyCheck = await checkAndConsumeKey(key, context, ip);
    if (!keyCheck.ok) {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: keyCheck.error }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Server misconfiguration: missing API key' }) };
    }

    const prompt = `You are a photo editor. Your job: swap the upholstery fabric on the furniture in IMAGE 1, using the fabric from IMAGE 2.

OUTPUT REQUIREMENTS — non-negotiable:
1. The output image must look DIFFERENT from IMAGE 1. The fabric color and texture MUST visibly change.
2. COLOR ACCURACY — 1:1 color match to IMAGE 2:
   - The new fabric color must be spectrally identical to IMAGE 2 — zero deviation in hue, saturation or brightness.
   - Render the fabric color as it appears under natural daylight (5500K). Use IMAGE 2 as the absolute color reference.
   - Preserve accurate color reproduction in shadows and highlights — do not darken, desaturate, shift the hue, or alter the color in any lighting zone.
   - The spectral hue of every upholstered surface must match the sample, whether in direct light, mid-tone, or shadow.
3. Recolor and retexture ALL soft surfaces: seat cushions, backrest, side panels, armrests, every piece of upholstered fabric on the furniture.

KEEP UNCHANGED:
- Camera angle, zoom, crop, background, room, lighting, shadows.
- Furniture shape, silhouette, dimensions, number of cushions, legs, frame.
- Non-fabric parts: wood, metal, plastic.

Do not return the original photo. Do not return a plain white background image. Generate the edited photo with the new fabric applied.`;

    const requestBody = {
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: furnitureMime, data: furnitureBase64 } },
        { inline_data: { mime_type: fabricMime,    data: fabricBase64    } }
      ]}],
      generationConfig: { temperature: 0.9, responseModalities: ['IMAGE', 'TEXT'], candidateCount: 1 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const MAX_RETRIES = 3;

    let lastError = null;
    const attempted = [];

    for (const model of MODELS) {
      attempted.push(model);
      let delay = 1000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const { ok, status, data } = await callGemini(model, requestBody, GEMINI_API_KEY);

        if (!ok) {
          lastError = data.error?.message || `Gemini ${model} failed (${status})`;
          if (OVERLOAD_CODES.has(status)) {
            console.warn(`[ritual] ${model} overloaded (${status}), attempt ${attempt}/${MAX_RETRIES}, next in ${delay}ms`);
            if (attempt < MAX_RETRIES) await sleep(delay);
            delay *= 2;
            continue;
          }
          tgNotifyError(TG_TOKEN, TG_CHAT_ID,
            `❌ <b>MAGICUM — помилка API</b>\n` +
            `👤 ${ip}\n` +
            `Модель: <code>${model}</code>\n` +
            `Код: ${status} | ${lastError}\n` +
            `⏰ ${time}`
          );
          return { statusCode: 500, body: JSON.stringify({ success: false, error: lastError }) };
        }

        const parts = data.candidates?.[0]?.content?.parts || [];
        let imageBase64 = null, mimeType = 'image/jpeg';
        for (const part of parts) {
          if (part.inlineData) { imageBase64 = part.inlineData.data; mimeType = part.inlineData.mimeType || mimeType; break; }
        }

        if (!imageBase64) {
          lastError = 'No image in Gemini response';
          console.warn(`[ritual] ${model} no image, attempt ${attempt}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) await sleep(delay);
          delay *= 2;
          continue;
        }

        const isFallback = attempted.length > 1;
        await tgSendRitual({
          token: TG_TOKEN, chatId: TG_CHAT_ID,
          sofa64: furnitureBase64, sofaMime: furnitureMime,
          fabric64: fabricBase64,  fabricMime,
          result64: imageBase64,   resultMime: mimeType,
          model, isFallback, ip, time
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, imageBase64, mimeType, model })
        };
      }

      console.warn(`[ritual] ${model} exhausted ${MAX_RETRIES} attempts, trying next model`);
    }

    await tgSendFailAlert({
      token: TG_TOKEN, chatId: TG_CHAT_ID,
      sofa64: furnitureBase64, sofaMime: furnitureMime,
      fabric64: fabricBase64, fabricMime,
      reason: `Всі моделі недоступні: ${attempted.join(', ')}\n${lastError}`,
      ip, time
    });
    return { statusCode: 503, body: JSON.stringify({ success: false, error: lastError || 'All models unavailable' }) };

  } catch (err) {
    console.error('ritual error:', err);
    tgNotifyError(TG_TOKEN, TG_CHAT_ID,
      `💥 <b>MAGICUM — критична помилка</b>\n` +
      `👤 ${ip}\n` +
      `<code>${err.message}</code>\n` +
      `⏰ ${time}`
    );
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
