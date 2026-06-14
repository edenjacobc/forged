module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://forgeduk.store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const SHOP_ID     = '100016423286';
  const SHOP_DOMAIN = 'forged-10046.myshopify.com';
  const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  // Verify OIDC token via Shopify userinfo
  let userInfo;
  try {
    const uRes = await fetch(
      `https://shopify.com/authentication/${SHOP_ID}/oauth/userinfo`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!uRes.ok) return res.status(401).json({ error: 'Invalid token' });
    userInfo = await uRes.json();
  } catch (e) {
    return res.status(500).json({ error: 'userinfo_failed: ' + e.message });
  }

  const email      = userInfo.email      || '';
  const firstName  = userInfo.given_name  || '';
  const lastName   = userInfo.family_name || '';
  const sub        = userInfo.sub         || '';
  const customerId = sub.includes('/') ? sub.split('/').pop() : sub;

  // No Admin token yet — return profile only
  if (!ADMIN_TOKEN || !customerId) {
    return res.status(200).json({
      firstName,
      lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }

  // Fetch orders from Admin API
  const gql = `query GetCustomer($id: ID!) {
    customer(id: $id) {
      firstName lastName
      orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id name processedAt financialStatus fulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 5) { nodes { name quantity } }
          fulfillments(first: 1) { trackingInfo(first: 1) { number url } }
        }
      }
    }
  }`;

  try {
    const aRes = await fetch(`https://${SHOP_DOMAIN}/admin/api/2024-10/graphql.json`, {
      method:  'POST',
      headers: {
        'Content-Type':            'application/json',
        'X-Shopify-Access-Token':  ADMIN_TOKEN,
      },
      body: JSON.stringify({ query: gql, variables: { id: `gid://shopify/Customer/${customerId}` } }),
    });
    const aData = await aRes.json();

    if (aData.errors || !aData.data?.customer) {
      return res.status(200).json({
        firstName, lastName,
        emailAddress: { emailAddress: email },
        orders: { nodes: [] },
      });
    }

    const c = aData.data.customer;
    return res.status(200).json({
      firstName:    c.firstName || firstName,
      lastName:     c.lastName  || lastName,
      emailAddress: { emailAddress: email },
      orders: {
        nodes: c.orders.nodes.map(o => ({
          ...o,
          totalPrice: o.totalPriceSet?.shopMoney || { amount: '0', currencyCode: 'GBP' },
          lineItems:  { nodes: o.lineItems.nodes.map(i => ({ title: i.name, quantity: i.quantity })) },
        })),
      },
    });
  } catch {
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }
};
