// ── MAGICUM · verify-key.js ─────────────────────────────────────────────────
// Keys are stored ONLY in Netlify environment variables — never in code.
// ---------------------------------------------------------------------------

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') return cors(405, { valid: false });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return cors(400, { valid: false }); }

  const key = (body.key || '').trim().toUpperCase();
  if (!key) return cors(400, { valid: false });

  // Odin key — unlimited
  const odinKey = (process.env.ODIN_KEY || '').trim().toUpperCase();
  if (odinKey && key === odinKey) {
    return cors(200, { valid: true, type: 'odin', name: 'Ключ Одіна', remaining: null });
  }

  // Silver Thread keys — 10 visualizations
  const silverKeys = (process.env.SILVER_KEYS || '').split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
  if (silverKeys.includes(key)) {
    return cors(200, { valid: true, type: 'silver', name: 'Silver Thread', remaining: 10 });
  }

  // Golden Seam keys — 30 visualizations
  const goldenKeys = (process.env.GOLDEN_KEYS || '').split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
  if (goldenKeys.includes(key)) {
    return cors(200, { valid: true, type: 'golden', name: 'Golden Seam', remaining: 30 });
  }

  return cors(200, { valid: false });
};
