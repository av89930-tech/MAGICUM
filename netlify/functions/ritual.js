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

async function checkAndConsumeKey(key, context) {
  const registry = getRegistry();
  // If KEY_REGISTRY not set in Netlify env — open access (setup mode)
  if (!registry) return { ok: true };

  // Registry is active — key is required
  if (!key) return { ok: false, error: 'Ключ не передано. Відкрийте Кабінет Майстра та введіть ключ.' };

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

    const prompt = `You are a professional furniture reupholstery visualizer. Task: take the FIRST image (furniture) and reupholster it using the fabric from the SECOND image. Rules: 1) Keep EXACTLY the same camera angle, composition, perspective, zoom level, and background as the first image. Do NOT zoom in. Do NOT crop any edges — show the COMPLETE furniture exactly as framed in the first image. 2) Keep the furniture shape, hard frame parts (wooden legs, metal feet, rigid plastic trims), and room environment identical. 3) CRITICAL — COVER ALL UPHOLSTERED SURFACES: Every soft fabric-covered area of the furniture MUST be reupholstered. This includes seat cushions, back cushions, side panels, armrests, armrest sides, outer side walls of the sofa/chair, front panels, and any other padded or fabric-covered surface — even if they are currently a different color or material than the seat. Do NOT leave any upholstered surface in its original fabric. 4) Replace every upholstered surface with the texture and color pattern from the second image (the fabric sample). 5) COLOR ACCURACY IS CRITICAL: The dominant color of the reupholstered surface MUST exactly match the fabric sample — use the fabric sample as the absolute color truth. Do NOT darken, desaturate, or shift the hue of the fabric color under any circumstances. The fully-lit areas of the furniture must show the fabric color at full saturation, exactly as it appears in the sample. Shadows may be slightly darker but must keep the same hue and remain vivid. 6) The result must look photorealistic. 7) Output a SINGLE image showing ONLY the reupholstered furniture. Do NOT include fabric swatches, color samples, comparison panels, labels, watermarks, or any elements other than the furniture itself.`;

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
