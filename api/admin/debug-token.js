const { getAdminToken } = require('./_token');

const SHOP  = 'forged-10046.myshopify.com';
const STAFF = ['edencovell@gmail.com', 'mackinevahn11@gmail.com'];

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

  if (!verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  let adminToken;
  try {
    adminToken = await getAdminToken();
  } catch (e) {
    return res.json({ error: 'getAdminToken failed: ' + e.message, SHOPIFY_ACCESS_TOKEN_set: !!process.env.SHOPIFY_ACCESS_TOKEN });
  }

  const masked = adminToken ? adminToken.slice(0, 8) + '...' + adminToken.slice(-4) : null;

  const [shopR, ordersR] = await Promise.all([
    fetch(`https://${SHOP}/admin/api/2026-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
    }),
    fetch(`https://${SHOP}/admin/api/2026-04/orders/count.json?status=any`, {
      headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
    }),
  ]);

  const shopBody   = await shopR.json().catch(() => ({}));
  const ordersBody = await ordersR.json().catch(() => ({}));

  return res.json({
    token_prefix:   masked,
    shop_status:    shopR.status,
    shop_name:      shopBody.shop?.name || null,
    orders_status:  ordersR.status,
    orders_error:   ordersBody.errors || ordersBody.error || null,
  });
};
