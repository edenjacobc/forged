(function () {
  const SHOP_ID   = '100016423286';
  const CLIENT_ID = '934f906e-c368-4a1a-9f9a-c5e938ed4e91';
  const REDIRECT  = 'https://forgeduk.store/account.html';
  const AUTH_URL  = `https://shopify.com/authentication/${SHOP_ID}/oauth/authorize`;
  const TOKEN_URL = `https://shopify.com/authentication/${SHOP_ID}/oauth/token`;
  const LOGOUT_URL= `https://shopify.com/authentication/${SHOP_ID}/logout`;
  const API_URL   = `https://shopify.com/${SHOP_ID}/account/customer/api/2024-10/graphql`;
  const SCOPES    = 'openid email';

  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function buildPKCE() {
    const verifier  = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const hash      = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = b64url(hash);
    return { verifier, challenge };
  }

  window.startLogin = async function () {
    try {
      const { verifier, challenge } = await buildPKCE();
      const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
      localStorage.setItem('pkce_v', verifier);
      localStorage.setItem('oauth_s', state);
      const p = new URLSearchParams({
        client_id:             CLIENT_ID,
        response_type:         'code',
        redirect_uri:          REDIRECT,
        scope:                 SCOPES,
        code_challenge:        challenge,
        code_challenge_method: 'S256',
        state,
      });
      window.location.href = `${AUTH_URL}?${p}`;
    } catch (e) {
      showError('Could not start login: ' + e.message);
    }
  };

  window.logout = function () {
    const idToken = localStorage.getItem('id_token');
    ['pkce_v', 'oauth_s', 'access_token', 'id_token'].forEach(k => localStorage.removeItem(k));
    const p = new URLSearchParams({ post_logout_redirect_uri: REDIRECT });
    if (idToken) p.set('id_token_hint', idToken);
    window.location.href = `${LOGOUT_URL}?${p}`;
  };

  async function exchangeCode(code) {
    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     CLIENT_ID,
        redirect_uri:  REDIRECT,
        code,
        code_verifier: localStorage.getItem('pkce_v'),
      }),
    });
    if (!res.ok) throw new Error('token_exchange');
    return res.json();
  }

  async function fetchCustomer(token) {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ query: `{
        customer {
          firstName lastName
          emailAddress { emailAddress }
          orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
            nodes {
              id name processedAt financialStatus fulfillmentStatus
              totalPrice { amount currencyCode }
              lineItems(first: 5) { nodes { title quantity } }
              fulfillments { trackingInfo { number url } }
            }
          }
        }
      }` }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    if (!json.data?.customer) throw new Error('No customer data. HTTP ' + res.status);
    return json.data.customer;
  }

  function orderStep(o) {
    const f = o.fulfillmentStatus;
    const p = o.financialStatus;
    if (f === 'FULFILLED')                                        return 5;
    if (f === 'IN_PROGRESS' || f === 'PARTIALLY_FULFILLED')      return 4;
    if (f === 'PENDING_FULFILLMENT' || f === 'OPEN')             return 3;
    if (p === 'PAID' || p === 'AUTHORIZED')                      return 2;
    return 1;
  }

  function renderOrder(o) {
    const step   = orderStep(o);
    const labels = ['Order placed', 'Payment confirmed', 'Preparing', 'Dispatched', 'Delivered'];
    const date   = new Date(o.processedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const total  = `£${parseFloat(o.totalPrice.amount).toFixed(2)}`;
    const items  = o.lineItems.nodes.map(i => i.quantity > 1 ? `${i.title} x${i.quantity}` : i.title).join(', ');
    const pct    = Math.round(((step - 1) / (labels.length - 1)) * 100);
    const track  = o.fulfillments?.[0]?.trackingInfo?.[0];

    const stepsHTML = labels.map((s, i) => `
      <div class="order-step ${i < step ? 'done' : ''} ${i === step - 1 ? 'current' : ''}">
        <div class="order-step-dot"></div>
        <span>${s}</span>
      </div>`).join('');

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <p class="order-number">${o.name}</p>
            <p class="order-meta">${date}</p>
          </div>
          <p class="order-total">${total}</p>
        </div>
        <p class="order-items">${items}</p>
        <div class="order-progress">
          <div class="order-track"><div class="order-track-fill" style="width:${pct}%"></div></div>
          <div class="order-steps">${stepsHTML}</div>
        </div>
        ${track ? `<a href="${track.url}" target="_blank" rel="noopener" class="order-track-link">Track with courier <i class="fa-solid fa-arrow-right"></i></a>` : ''}
      </div>`;
  }

  function show(view) {
    ['login', 'loading', 'dashboard'].forEach(v =>
      document.getElementById(`account-${v}`).style.display = v === view ? '' : 'none'
    );
  }

  function showError(msg) {
    show('login');
    const el = document.getElementById('acct-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function renderDashboard(c) {
    document.getElementById('acct-name').textContent  = `${c.firstName} ${c.lastName}`;
    document.getElementById('acct-email').textContent = c.emailAddress?.emailAddress || '';
    const el = document.getElementById('acct-orders');
    el.innerHTML = c.orders.nodes.length
      ? c.orders.nodes.map(renderOrder).join('')
      : `<p class="acct-empty">No orders yet. <a href="shop.html">Browse the shop</a></p>`;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');

    if (code) {
      const savedState = localStorage.getItem('oauth_s');
      if (state !== savedState) {
        showError(`State mismatch (got ${state?.slice(0,8)}, expected ${savedState?.slice(0,8)}). Try again.`);
        return;
      }
      try {
        show('loading');
        const tokens = await exchangeCode(code);
        if (!tokens.access_token) {
          showError('Token exchange returned no access token. Response: ' + JSON.stringify(tokens));
          return;
        }
        localStorage.setItem('access_token', tokens.access_token);
        if (tokens.id_token) localStorage.setItem('id_token', tokens.id_token);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        showError('Token exchange failed: ' + e.message);
        return;
      }
    }

    const token = localStorage.getItem('access_token');
    if (!token) { show('login'); return; }

    try {
      show('loading');
      const customer = await fetchCustomer(token);
      renderDashboard(customer);
      show('dashboard');
    } catch (e) {
      localStorage.removeItem('access_token');
      showError('Could not load account: ' + e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
