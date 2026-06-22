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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  if (!verifyStaff(req)) return res.status(403).json({ error: 'Forbidden' });

  const { inventoryItemId, variantId, quantity } = req.body || {};
  if (!inventoryItemId || quantity === undefined) {
    return res.status(400).json({ error: 'inventoryItemId and quantity required' });
  }
  if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
    return res.status(400).json({ error: 'quantity must be a non-negative integer' });
  }

  const itemIdInt    = parseInt(inventoryItemId, 10);
  const variantIdInt = variantId ? parseInt(variantId, 10) : null;

  try {
    const adminToken = await getAdminToken();

    // Get active location
    const locR = await fetch(`https://${SHOP}/admin/api/2026-04/locations.json`, {
      headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
    });
    if (!locR.ok) throw new Error(`Locations fetch failed: ${locR.status}`);
    const { locations } = await locR.json();
    const location = (locations || []).find(l => l.active) || locations?.[0];
    if (!location) return res.status(500).json({ error: 'No Shopify location found' });

    // Fetch the inventory item to check its sku and tracked status
    const itemR = await fetch(`https://${SHOP}/admin/api/2026-04/inventory_items/${itemIdInt}.json`, {
      headers: { 'X-Shopify-Access-Token': adminToken, Accept: 'application/json' },
    });
    if (!itemR.ok) throw new Error(`Inventory item fetch failed: ${itemR.status}`);
    const { inventory_item } = await itemR.json();

    const needsSku     = !inventory_item.sku || inventory_item.sku.trim() === '';
    const needsTracked = !inventory_item.tracked;

    // Directly patch the inventory item with sku + tracked if either is missing
    if (needsSku || needsTracked) {
      const sku = needsSku ? `FRG-${itemIdInt}` : inventory_item.sku;
      const patchR = await fetch(`https://${SHOP}/admin/api/2026-04/inventory_items/${itemIdInt}.json`, {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_item: { id: itemIdInt, sku, tracked: true } }),
      });
      if (!patchR.ok) {
        const e = await patchR.json().catch(() => ({}));
        throw new Error(`Failed to patch inventory item: ${JSON.stringify(e.errors || e)}`);
      }
    }

    // Also ensure the variant has inventory_management: 'shopify'
    if (variantIdInt) {
      await fetch(`https://${SHOP}/admin/api/2026-04/variants/${variantIdInt}.json`, {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: { id: variantIdInt, inventory_management: 'shopify' } }),
      });
    }

    // Set inventory level
    const setR = await fetch(`https://${SHOP}/admin/api/2026-04/inventory_levels/set.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id:       parseInt(location.id, 10),
        inventory_item_id: itemIdInt,
        available:         quantity,
      }),
    });
    if (!setR.ok) {
      const err = await setR.json().catch(() => ({}));
      const msg = Array.isArray(err.errors) ? err.errors.join(', ')
        : typeof err.errors === 'string' ? err.errors
        : JSON.stringify(err.errors || err);
      throw new Error(msg);
    }
    const result = await setR.json();
    return res.json({ ok: true, level: result.inventory_level });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
