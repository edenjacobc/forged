async function getAdminToken() {
  const direct = process.env.SHOPIFY_ACCESS_TOKEN;
  if (direct) return direct;
  throw new Error('Set SHOPIFY_ACCESS_TOKEN in Vercel environment variables (Admin API access token from your Shopify custom app).');
}

module.exports = { getAdminToken };
