const { getStore } = require('@netlify/blobs');

function blobStore(context) {
  const opts = { name: 'magicum', context };
  if (process.env.NETLIFY_SITE_ID)    opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_BLOBS_TOKEN) opts.token  = process.env.NETLIFY_BLOBS_TOKEN;
  return getStore(opts);
}

exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(24, Math.max(1, parseInt(params.limit || '12', 10)));

  try {
    const store = blobStore(context);
    const indexRaw = await store.get('index:all');
    const index = indexRaw ? JSON.parse(indexRaw) : [];

    const total = index.length;
    const start = (page - 1) * limit;
    const items = index.slice(start, start + limit);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30'
      },
      body: JSON.stringify({ success: true, total, page, limit, items })
    };
  } catch (err) {
    console.error('cases-list error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
