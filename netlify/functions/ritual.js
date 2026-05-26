const { getStore } = require('@netlify/blobs');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp',
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

async function checkAndConsumeKey(key, context) {
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

  // ── Tier 4: Anonymous — frontend handles 3-use limit via localStorage ──
  // Server allows through; client already tracks and warns
  return { ok: true, tier: 'anon' };
}

const OVERLOAD_CODES = new Set([429, 503, 529]);

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
    const keyCheck = await checkAndConsumeKey(key, context);
    if (!keyCheck.ok) {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: keyCheck.error }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Server misconfiguration: missing API key' }) };
    }

    const prompt = `This is a TEXTURE REPLACEMENT task — like applying a material swap in 3D software (Blender/3ds Max). You are NOT generating a new image. You are editing the existing photo.

INPUT 1 = source photo of furniture. This is your canvas. Do not change anything about it except the fabric surface.
INPUT 2 = fabric texture sample. Extract the color, pattern and texture from this sample.

WHAT TO DO:
- Keep INPUT 1 exactly as-is: same camera angle, same zoom, same crop, same background, same lighting, same shadows, same furniture shape, same silhouette, same dimensions, same number of cushions, same armrests, same legs, same everything.
- Replace ONLY the soft upholstered surfaces (seat cushions, backrest, side panels, armrests, outer fabric walls) with the material from INPUT 2.
- Hard non-fabric parts (metal legs, wooden frame, plastic trim) stay unchanged.

WHAT NOT TO DO:
- Do NOT zoom in or out.
- Do NOT change the shape or silhouette of the furniture even slightly.
- Do NOT add or remove cushions, sections, or structural elements.
- Do NOT change the background or room environment.
- Do NOT crop differently than INPUT 1.
- Do NOT create a new composition — only edit the existing one.

COLOR: The fabric color in the output must be identical to INPUT 2. Do not darken, desaturate or alter the hue.

OUTPUT: One single photorealistic image — a copy of INPUT 1 with only the fabric surface texture swapped.`;

    const requestBody = {
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: furnitureMime, data: furnitureBase64 } },
        { inline_data: { mime_type: fabricMime,    data: fabricBase64    } }
      ]}],
      generationConfig: { temperature: 0.4, responseModalities: ['IMAGE', 'TEXT'], candidateCount: 1 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    let lastError = null;
    const attempted = [];

    for (const model of MODELS) {
      const { ok, status, data } = await callGemini(model, requestBody, GEMINI_API_KEY);
      attempted.push(model);

      if (!ok) {
        lastError = data.error?.message || `Gemini ${model} failed (${status})`;
        if (OVERLOAD_CODES.has(status)) {
          console.warn(`[ritual] ${model} overloaded (${status}), trying fallback`);
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
        console.warn(`[ritual] ${model} returned no image, trying fallback`);
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

    tgNotifyError(TG_TOKEN, TG_CHAT_ID,
      `🔴 <b>MAGICUM — всі моделі недоступні</b>\n` +
      `👤 ${ip}\n` +
      `Спробували: ${attempted.join(', ')}\n` +
      `${lastError}\n` +
      `⏰ ${time}`
    );
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
