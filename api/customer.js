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
  const ADMIN_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  // Verify OIDC token via Shopify userinfo
  let userInfo;
  try {
    const uRes = await fetch(
      `https://shopify.com/authentication/${SHOP_ID}/oauth/userinfo`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!uRes.ok) {
      console.error('[customer] userinfo failed:', uRes.status);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    userInfo = await uRes.json();
  } catch (e) {
    return res.status(500).json({ error: 'userinfo_failed: ' + e.message });
  }

  const email     = userInfo.email      || '';
  const firstName = userInfo.given_name  || '';
  const lastName  = userInfo.family_name || '';

  if (!ADMIN_TOKEN) {
    console.error('[customer] SHOPIFY_ACCESS_TOKEN not set');
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }

  if (!email) {
    return res.status(200).json({
      firstName, lastName,
      emailAddress: { emailAddress: email },
      orders: { nodes: [] },
    });
  }

  // Look up customer by email — more reliable than using the OIDC sub,
  // which is a CustomerAccount GID and does not match the Admin API Customer GID.
  const gql = `query GetCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
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
    }
  }`;

  try {
    const aRes = await fetch(`https://${SHOP_DOMAIN}/admin/api/2024-10/graphql.json`, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-Shopify-Access-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ query: gql, variables: { query: `email:${email}` } }),
    });
    const aData = await aRes.json();

    if (aData.errors) {
      console.error('[customer] Admin API errors:', JSON.stringify(aData.errors));
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
