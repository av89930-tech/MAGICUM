exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valid: false }) };
  }
  try {
    const { key } = JSON.parse(event.body || '{}');
    if (!key) return { statusCode: 200, body: JSON.stringify({ valid: false }) };

    const raw = process.env.CABINET_KEYS || 'MAGICUM-2026,BRAMA-ZOLOTA,ATELIE-PRO,MASTER-FABRIC,DIZAIN-STUDIO,RESTAVRATOR-UA';
    const keys = new Set(raw.split(',').map(k => k.trim().toUpperCase()));
    const valid = keys.has(key.trim().toUpperCase());

    return { statusCode: 200, body: JSON.stringify({ valid }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ valid: false }) };
  }
};
