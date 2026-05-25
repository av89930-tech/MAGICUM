const { getStore } = require('@netlify/blobs');

function blobStore(context) {
  const opts = { name: 'magicum', context };
  if (process.env.NETLIFY_SITE_ID)    opts.siteID = process.env.NETLIFY_SITE_ID;
  if (process.env.NETLIFY_BLOBS_TOKEN) opts.token  = process.env.NETLIFY_BLOBS_TOKEN;
  return getStore(opts);
}

exports.handler = async (event, context) => {
  const slug = (event.queryStringParameters || {}).slug || '';

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { statusCode: 400, body: 'Bad Request' };
  }

  try {
    const store = blobStore(context);
    const raw = await store.get(`case:${slug}`);

    if (!raw) {
      return { statusCode: 404, body: 'Not Found' };
    }

    const c = JSON.parse(raw);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable'
      },
      body: c.afterB64,
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('case-image error:', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
