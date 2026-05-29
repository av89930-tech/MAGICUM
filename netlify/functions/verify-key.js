// ── MAGICUM · verify-key.js ─────────────────────────────────────────────────
// Keys are stored in CABINET_KEYS env var as JSON:
// {"odin":"...","silver":[...],"golden":[...]}
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

  // Parse CABINET_KEYS (JSON format)
  let vault = {};
  try { vault = JSON.parse(process.env.CABINET_KEYS || '{}'); }
  catch (_) { vault = {}; }

  const odinKey    = (vault.odin   || '').trim().toUpperCase();
  const silverKeys = (vault.silver || []).map(k => k.trim().toUpperCase());
  const goldenKeys = (vault.golden || []).map(k => k.trim().toUpperCase());

  if (odinKey && key === odinKey) {
    return cors(200, { valid: true, type: 'odin', name: 'Ключ Одіна', remaining: null });
  }

  if (silverKeys.includes(key)) {
    return cors(200, { valid: true, type: 'silver', name: 'Silver Thread', remaining: 10 });
  }

  if (goldenKeys.includes(key)) {
    return cors(200, { valid: true, type: 'golden', name: 'Golden Seam', remaining: 30 });
  }

  return cors(200, { valid: false });
};
