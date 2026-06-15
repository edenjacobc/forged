const { getAdminToken } = require('./_token');

const SHOP    = 'forged-10046.myshopify.com';
const SHOP_ID = '100016423286';
const STAFF   = ['edencovell@gmail.com', 'mackinevahn11@gmail.com'];

function verifyStaff(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return STAFF.includes(payload.email);
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  if (!verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const adminToken = await getAdminToken();
    const r = await fetch(
      `https://${SHOP}/admin/api/2026-04/customers.json?limit=100&order=created_at+DESC&fields=id,email,first_name,last_name,created_at,orders_count,total_spent,verified_email`,
      { headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' } }
    );
    if (!r.ok) throw new Error(`Shopify ${r.status}`);
    const data = await r.json();
    return res.json({ customers: data.customers || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
