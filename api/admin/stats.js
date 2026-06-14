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

async function shopify(path, adminToken) {
  const r = await fetch(`https://${SHOP}/admin/api/2024-10${path}`, {
    headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Shopify ${r.status} ${path}`);
  return r.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  if (!verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ error: 'SHOPIFY_ADMIN_TOKEN not set in Vercel environment variables.' });

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [orderCount, customerCount, productCount, recentOrders, revenueOrders] = await Promise.all([
      shopify('/orders/count.json?status=any', adminToken),
      shopify('/customers/count.json', adminToken),
      shopify('/products/count.json', adminToken),
      shopify('/orders.json?status=any&limit=15&fields=id,name,email,total_price,financial_status,fulfillment_status,created_at,line_items', adminToken),
      shopify(`/orders.json?status=any&created_at_min=${thirtyDaysAgo}&limit=250&fields=id,total_price,financial_status`, adminToken),
    ]);

    const revenue30d = (revenueOrders.orders || [])
      .filter(o => ['paid', 'partially_refunded'].includes(o.financial_status))
      .reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

    return res.json({
      totalOrders:    orderCount.count    || 0,
      totalCustomers: customerCount.count || 0,
      totalProducts:  productCount.count  || 0,
      revenue30d:     revenue30d.toFixed(2),
      recentOrders:   recentOrders.orders || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
