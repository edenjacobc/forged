const https = require('https');

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

function post(hostname, path, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://forgeduk.store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const SHOP_ID    = '100016423286';
  const SHOP_DOMAIN = 'forged-10046.myshopify.com';
  const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!ADMIN_TOKEN) return res.status(500).json({ error: 'Admin token not configured' });

  // 1. Verify the OIDC token + get customer identity via Shopify userinfo
  const uInfo = await get(
    `https://shopify.com/authentication/${SHOP_ID}/oauth/userinfo`,
    { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  );

  if (uInfo.status !== 200) {
    return res.status(401).json({ error: 'Invalid token', detail: uInfo.body });
  }

  let userInfo;
  try { userInfo = JSON.parse(uInfo.body); } catch {
    return res.status(500).json({ error: 'Bad userinfo response' });
  }

  // sub is "gid://shopify/Customer/12345" or just a numeric ID
  const sub = userInfo.sub || '';
  const customerId = sub.includes('/') ? sub.split('/').pop() : sub;

  if (!customerId) return res.status(400).json({ error: 'No customer ID in token' });

  // 2. Fetch customer + orders from Admin API
  const adminGid = `gid://shopify/Customer/${customerId}`;
  const query = {
    query: `query GetCustomer($id: ID!) {
      customer(id: $id) {
        firstName lastName email
        orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id name processedAt financialStatus fulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 5) { nodes { name quantity } }
            fulfillments(first: 1) {
              trackingInfo(first: 1) { number url }
            }
          }
        }
      }
    }`,
    variables: { id: adminGid },
  };

  const adminRes = await post(
    SHOP_DOMAIN,
    '/admin/api/2024-10/graphql.json',
    { 'X-Shopify-Access-Token': ADMIN_TOKEN },
    query
  );

  let adminData;
  try { adminData = JSON.parse(adminRes.body); } catch {
    return res.status(500).json({ error: 'Bad admin API response' });
  }

  if (adminData.errors) {
    return res.status(500).json({ error: 'Admin API error', detail: adminData.errors });
  }

  const customer = adminData.data?.customer;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Normalise to match frontend expectations
  return res.status(200).json({
    firstName: customer.firstName,
    lastName:  customer.lastName,
    emailAddress: { emailAddress: customer.email },
    orders: {
      nodes: customer.orders.nodes.map(o => ({
        ...o,
        totalPrice: o.totalPriceSet?.shopMoney || { amount: '0', currencyCode: 'GBP' },
        lineItems:  { nodes: o.lineItems.nodes.map(i => ({ title: i.name, quantity: i.quantity })) },
      })),
    },
  });
};
