const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
];

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

exports.handler = async (event) => {
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
    const { furnitureBase64, furnitureMime, fabricBase64, fabricMime } = JSON.parse(event.body || '{}');

    if (!furnitureBase64 || !fabricBase64) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing images' }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Server misconfiguration: missing API key' }) };
    }

    const prompt = `You are a professional furniture reupholstery visualizer. Task: take the FIRST image (sofa/furniture) and reupholster it using the fabric texture and color from the SECOND image. Rules: 1) Keep EXACTLY the same camera angle, composition, perspective, zoom level, and background as the first image. 2) Keep the furniture shape, frame, legs, cushion forms, shadows and room environment identical. 3) Replace ONLY the upholstery/fabric surface with the texture and color pattern from the second image. 4) The result must look photorealistic. Output only the resulting image.`;

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

      // Відправляємо альбом у Telegram (fire and forget)
      tgSendRitual({
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
