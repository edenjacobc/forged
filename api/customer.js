const { getAdminToken } = require('./admin/_token');

const SHOP_DOMAIN = 'forged-10046.myshopify.com';
const API         = '2026-04';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://forgeduk.store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  // Decode id_token JWT directly — avoids fragile userinfo network call
  let email, firstName, lastName;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Not a JWT');
    const pad = s => s + '='.repeat((4 - s.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(pad(parts[1].replace(/-/g, '+').replace(/_/g, '/')), 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token expired' });
    }
    email     = payload.email       || '';
    firstName = payload.given_name  || '';
    lastName  = payload.family_name || '';
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }

  if (!email) {
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }

  let adminToken;
  try {
    adminToken = await getAdminToken();
  } catch (e) {
    console.error('[customer] getAdminToken failed:', e.message);
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }

  const gql = `query GetCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        firstName lastName
        orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id name processedAt displayFinancialStatus displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 5) { nodes { name quantity } }
            fulfillments(first: 1) { trackingInfo(first: 1) { number url } }
          }
        }
      }
    }
  }`;

  try {
    const aRes = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API}/graphql.json`, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({ query: gql, variables: { query: `email:${email}` } }),
    });
    const aData = await aRes.json();

    if (aData.errors) {
      console.error('[customer] Admin API errors:', JSON.stringify(aData.errors));
      return res.status(200).json({
        firstName, lastName,
        emailAddress: { emailAddress: email },
        orders: { nodes: [] },
        _debug: 'graphql errors: ' + JSON.stringify(aData.errors),
      });
    }

    const c = aData.data?.customers?.nodes?.[0];
    if (!c) {
      console.error('[customer] No customer found for email:', email);
      return res.status(200).json({
        firstName, lastName,
        emailAddress: { emailAddress: email },
        orders: { nodes: [] },
        _debug: 'no customer record found for ' + email,
      });
    }

    return res.status(200).json({
      firstName:    c.firstName || firstName,
      lastName:     c.lastName  || lastName,
      emailAddress: { emailAddress: email },
      orders: {
        nodes: c.orders.nodes.map(o => ({
          ...o,
          financialStatus:   o.displayFinancialStatus,
          fulfillmentStatus: o.displayFulfillmentStatus,
          totalPrice: o.totalPriceSet?.shopMoney || { amount: '0', currencyCode: 'GBP' },
          lineItems:  { nodes: o.lineItems.nodes.map(i => ({ title: i.name, quantity: i.quantity })) },
        })),
      },
    });
  } catch (e) {
    console.error('[customer] Admin API fetch error:', e.message);
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }
};
