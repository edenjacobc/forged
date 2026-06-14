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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  if (!verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ error: 'SHOPIFY_ADMIN_TOKEN not set.' });

  const { inventoryItemId, quantity } = req.body || {};
  if (!inventoryItemId || quantity === undefined) {
    return res.status(400).json({ error: 'inventoryItemId and quantity required' });
  }
  if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
    return res.status(400).json({ error: 'quantity must be a non-negative integer' });
  }

  try {
    // Get primary active location
    const locR = await fetch(`https://${SHOP}/admin/api/2024-10/locations.json`, {
      headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
    });
    if (!locR.ok) throw new Error(`Locations fetch failed: ${locR.status}`);
    const locData = await locR.json();
    const location = (locData.locations || []).find(l => l.active) || locData.locations?.[0];
    if (!location) return res.status(500).json({ error: 'No Shopify location found' });

    // Set inventory level
    const setR = await fetch(`https://${SHOP}/admin/api/2024-10/inventory_levels/set.json`, {
      method:  'POST',
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location_id:       location.id,
        inventory_item_id: inventoryItemId,
        available:         quantity,
      }),
    });
    if (!setR.ok) {
      const err = await setR.json().catch(() => ({}));
      throw new Error(err.errors || `Inventory update failed: ${setR.status}`);
    }
    const result = await setR.json();
    return res.json({ ok: true, level: result.inventory_level });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
