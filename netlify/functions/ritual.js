// ── MAGICUM · Netlify Function: ritual.js ──────────────────────────────────
// Gemini image generation with exponential backoff + Telegram error alerts
// ---------------------------------------------------------------------------

const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
];

const PROMPT = `Ти — майстер цифрової переобивки меблів.
Завдання: замінити оббивку на меблях із першого зображення на тканину з другого зображення.
Вимоги:
- Збережи форму меблів, каркас, ніжки, складки, тіні та оточення — без змін
- Нова оббивка точно відповідає кольору, фактурі та візерунку тканини з другого фото
- Фотореалістичний результат, без артефактів і деформацій
- Не змінюй ракурс, освітлення, фон і пропорції
Поверни тільки зображення.`;

async function callGemini(apiKey, model, furnitureBase64, furnitureMime, fabricBase64, fabricMime) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: furnitureMime, data: furnitureBase64 } },
        { inline_data: { mime_type: fabricMime,    data: fabricBase64   } }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      responseModalities: ['IMAGE', 'TEXT'],
      candidateCount: 1
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return { imageBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/jpeg' };
    }
  }
  throw new Error('No image in Gemini response');
}

async function withBackoff(fn, attempts = 3, baseDelay = 1500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function sendTelegram(msg) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg.slice(0, 4096), parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (_) {}
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') return cors(405, { success: false, error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return cors(500, { success: false, error: 'Server misconfiguration' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return cors(400, { success: false, error: 'Invalid JSON' }); }

  const { furnitureBase64, furnitureMime = 'image/jpeg', fabricBase64, fabricMime = 'image/jpeg' } = body;
  if (!furnitureBase64 || !fabricBase64) return cors(400, { success: false, error: 'Missing images' });

  // ── Try each model with backoff ──────────────────────────────────────────
  const errors = [];
  for (const model of MODELS) {
    try {
      const result = await withBackoff(
        () => callGemini(GEMINI_KEY, model, furnitureBase64, furnitureMime, fabricBase64, fabricMime),
        3,   // спроб
        1500 // базова затримка мс
      );
      return cors(200, { success: true, ...result });
    } catch (e) {
      errors.push(`[${model}]: ${e.message}`);
    }
  }

  // All models failed — notify via Telegram
  const errMsg = `🔴 MAGICUM ritual FAILED\n${errors.join('\n')}`;
  await sendTelegram(errMsg);

  return cors(500, { success: false, error: 'Всі спроби вичерпано. Спробуйте за хвилину.' });
};
