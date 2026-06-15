const CLIENT_ID    = process.env.SHOPIFY_CLIENT_ID;
const SHOP         = 'forged-10046.myshopify.com';
const REDIRECT_URI = 'https://forgeduk.store/api/admin/oauth-callback';
const SCOPES       = 'read_orders,read_customers,read_products,write_inventory';

module.exports = function handler(req, res) {
  if (!CLIENT_ID) return res.status(500).send('SHOPIFY_CLIENT_ID not set');
  const state = Math.random().toString(36).slice(2);
  const url = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
  res.redirect(url);
};
