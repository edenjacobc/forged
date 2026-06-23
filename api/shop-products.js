const { getAdminToken } = require('./admin/_token');

const SHOP = 'forged-10046.myshopify.com';
const API  = '2026-04';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminToken();

    const r = await fetch(
      `https://${SHOP}/admin/api/${API}/products.json?status=active&limit=50&fields=id,title,handle,body_html,tags,product_type,images,variants`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );

    if (!r.ok) return res.status(r.status).json({ error: `Shopify ${r.status}` });

    const { products } = await r.json();

    /* Normalise to the shape shopify.js expects */
    const out = products.map(p => ({
      id:          `gid://shopify/Product/${p.id}`,
      title:       p.title,
      handle:      p.handle,
      description: p.body_html || '',
      tags:        typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : (p.tags || []),
      productType: p.product_type || '',
      featuredImage: p.images?.[0] ? { url: p.images[0].src, altText: p.images[0].alt || '' } : null,
      images: {
        nodes: (p.images || []).map(img => ({ url: img.src, altText: img.alt || '', shopifyId: img.id }))
      },
      variants: {
        nodes: (p.variants || []).map(v => ({
          id:              `gid://shopify/ProductVariant/${v.id}`,
          title:           v.title,
          price:           { amount: v.price, currencyCode: 'GBP' },
          compareAtPrice:  v.compare_at_price ? { amount: v.compare_at_price } : null,
          availableForSale: v.inventory_quantity > 0,
          imageId:         v.image_id || null
        }))
      }
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.json({ products: out });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
