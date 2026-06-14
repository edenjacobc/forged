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

  if (!await verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ error: 'SHOPIFY_ADMIN_TOKEN not set.' });

  try {
    const [productsData, locationsData] = await Promise.all([
      shopify('/products.json?limit=100&fields=id,title,status,variants', adminToken),
      shopify('/locations.json', adminToken),
    ]);

    const primaryLocation = (locationsData.locations || []).find(l => l.active) || locationsData.locations?.[0];
    const locationId = primaryLocation?.id || null;

    const products = (productsData.products || []).map(p => ({
      id:     p.id,
      title:  p.title,
      status: p.status,
      variants: (p.variants || []).map(v => ({
        id:                  v.id,
        title:               v.title,
        price:               v.price,
        sku:                 v.sku,
        inventory_item_id:   v.inventory_item_id,
        inventory_quantity:  v.inventory_quantity,
      })),
    }));

    return res.json({ products, locationId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
