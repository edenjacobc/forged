const SHOP = 'forged-10046.myshopify.com';

let _cache = { token: null, expiresAt: 0 };

async function getAdminToken() {
  if (_cache.token && Date.now() < _cache.expiresAt - 60_000) {
    return _cache.token;
  }

  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel environment variables.');
  }

  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token exchange failed (${r.status})`);
  }

  const data = await r.json();
  _cache.token     = data.access_token;
  _cache.expiresAt = Date.now() + (data.expires_in || 86400) * 1000;
  return _cache.token;
}

module.exports = { getAdminToken };
