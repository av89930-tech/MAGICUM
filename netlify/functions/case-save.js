// ── MAGICUM · case-save.js ──────────────────────────────────────────────────
// Saves visualization case to Netlify Blobs and returns a shareable URL
// ---------------------------------------------------------------------------

const { getStore } = require('@netlify/blobs');

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return cors(405, { success: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return cors(400, { success: false, error: 'Invalid JSON' });
  }

  const { furnitureType, fabricName, city, beforeB64, afterB64 } = body;
  if (!beforeB64 || !afterB64) {
    return cors(400, { success: false, error: 'Missing images' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const caseData = {
    id,
    furnitureType: furnitureType || 'диван',
    fabricName: fabricName || '',
    city: city || '',
    createdAt: new Date().toISOString(),
    beforeB64,
    afterB64,
  };

  try {
    const store = getStore({
      name: 'cases',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    await store.setJSON(id, caseData);
    return cors(200, { success: true, url: `/case/${id}` });
  } catch (e) {
    return cors(500, { success: false, error: `Помилка збереження: ${e.message}` });
  }
};
