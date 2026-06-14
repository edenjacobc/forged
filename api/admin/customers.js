const SHOP    = 'forged-10046.myshopify.com';
const SHOP_ID = '100016423286';
const STAFF   = 'edencovell@gmail.com';

async function verifyStaff(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return false;
  try {
    const r = await fetch(`https://shopify.com/authentication/${SHOP_ID}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!r.ok) return false;
    const info = await r.json();
    return info.email === STAFF;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  if (!await verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ error: 'SHOPIFY_ADMIN_TOKEN not set.' });

  try {
    const r = await fetch(
      `https://${SHOP}/admin/api/2024-10/customers.json?limit=100&order=created_at+DESC&fields=id,email,first_name,last_name,created_at,orders_count,total_spent,verified_email`,
      { headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' } }
    );
    if (!r.ok) throw new Error(`Shopify ${r.status}`);
    const data = await r.json();
    return res.json({ customers: data.customers || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
