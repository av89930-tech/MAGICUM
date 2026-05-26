const { getStore } = require('@netlify/blobs');

function getRegistry() {
  const raw = process.env.KEY_REGISTRY;
  if (!raw) return {};
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  catch(e) { return {}; }
}

function usageStore(context) {
  const opts = { name: 'key-usage', context };
  if (process.env.NETLIFY_SITE_ID)     opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_BLOBS_TOKEN) opts.token  = process.env.NETLIFY_BLOBS_TOKEN;
  return getStore(opts);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valid: false }) };
  }
  try {
    const { key } = JSON.parse(event.body || '{}');
    if (!key) return { statusCode: 200, body: JSON.stringify({ valid: false }) };

    const registry = getRegistry();
    const entry    = registry[key.trim().toUpperCase()];

    if (!entry) return { statusCode: 200, body: JSON.stringify({ valid: false }) };

    // Unlimited key
    if (entry.limit === null) {
      const store = usageStore(context);
      const usedRaw = await store.get('key_' + key).catch(() => null);
      const used = usedRaw ? parseInt(usedRaw, 10) : 0;
      return { statusCode: 200, body: JSON.stringify({ valid: true, remaining: null, used, name: entry.name }) };
    }

    // Limited key
    const store   = usageStore(context);
    const usedRaw = await store.get('key_' + key).catch(() => null);
    const used    = usedRaw ? parseInt(usedRaw, 10) : 0;
    const remaining = Math.max(0, entry.limit - used);

    return {
      statusCode: 200,
      body: JSON.stringify({ valid: remaining > 0, remaining, used, limit: entry.limit, name: entry.name })
    };
  } catch (e) {
    console.error('verify-key error:', e);
    return { statusCode: 500, body: JSON.stringify({ valid: false }) };
  }
};
