const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOP          = 'forged-10046.myshopify.com';

module.exports = async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return res.status(400).send(`Shopify error: ${error}`);
  if (!code)  return res.status(400).send('No code received from Shopify');

  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(500).send(`Token exchange failed: ${JSON.stringify(err)}`);
  }

  const data = await r.json();
  const token = data.access_token;

  res.send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px">
      <h2>App installed successfully</h2>
      <p>Copy this access token and add it to Vercel as <strong>SHOPIFY_ACCESS_TOKEN</strong>:</p>
      <code style="display:block;background:#f4f4f4;padding:16px;border-radius:8px;word-break:break-all;font-size:14px">${token}</code>
      <p style="margin-top:24px;color:#666">After saving it in Vercel, redeploy and delete this endpoint from your codebase.</p>
    </body></html>
  `);
};
