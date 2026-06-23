(function () {
  const SHOP_ID   = '100016423286';
  const CLIENT_ID = '934f906e-c368-4a1a-9f9a-c5e938ed4e91';
  const REDIRECT  = 'https://forgeduk.store/account.html';
  const AUTH_URL  = `https://shopify.com/authentication/${SHOP_ID}/oauth/authorize`;
  const TOKEN_URL = `https://shopify.com/authentication/${SHOP_ID}/oauth/token`;
  const LOGOUT_URL= `https://shopify.com/authentication/${SHOP_ID}/logout`;

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
        scope:                 'openid email',
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.error || 'code_exchange_failed');
    }
    return res.json();
  }

  function decodeJWT(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    } catch { return null; }
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

  function orderStep(o) {
    const f = o.fulfillmentStatus;
    const p = o.financialStatus;
    if (f === 'FULFILLED')                                    return 5;
    if (f === 'IN_PROGRESS' || f === 'PARTIALLY_FULFILLED')  return 4;
    if (f === 'PENDING_FULFILLMENT' || f === 'OPEN')         return 3;
    if (p === 'PAID' || p === 'AUTHORIZED')                  return 2;
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
        <div class="order-step-dot"></div><span>${s}</span>
      </div>`).join('');
    return `
      <div class="order-card">
        <div class="order-card-header">
          <div><p class="order-number">${o.name}</p><p class="order-meta">${date}</p></div>
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

  window.acctTab = function (tab, btn) {
    document.querySelectorAll('.acct-tab').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.acct-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('acct-tab-' + tab).style.display = '';
    if (btn) btn.classList.add('active');
    if (tab === 'garage') renderGarageTab();
  };

  function renderGarageTab() {
    const cars = window.forgedGarage?.get() || [];
    const list = document.getElementById('acct-garage-list');
    if (!list) return;
    list.innerHTML = cars.length
      ? cars.map(c => {
          const name   = [c.make, c.model].filter(Boolean).join(' ');
          const detail = [c.year, c.colour ? c.colour.charAt(0).toUpperCase() + c.colour.slice(1).toLowerCase() : ''].filter(Boolean).join(' · ');
          return `
            <div class="acct-garage-car">
              <div class="acct-garage-plate">${c.reg}</div>
              <div class="acct-garage-car-info">
                ${name   ? `<p class="acct-garage-car-name">${name}</p>` : ''}
                ${detail ? `<p class="acct-garage-car-detail">${detail}</p>` : ''}
              </div>
              <button class="acct-garage-car-remove" onclick="acctGarageRemove('${c.reg}')" title="Remove">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>`;
        }).join('')
      : '<p class="acct-empty">No cars saved yet. Add your first one below.</p>';
  }

  window.acctGarageShowAdd = function () {
    document.getElementById('acct-garage-add-form').style.display = '';
    document.getElementById('acct-add-car-btn').style.display = 'none';
    document.getElementById('acct-add-reg')?.focus();
  };

  window.acctGarageHideAdd = function () {
    document.getElementById('acct-garage-add-form').style.display = 'none';
    document.getElementById('acct-add-car-btn').style.display = '';
    const inp = document.getElementById('acct-add-reg');
    const sta = document.getElementById('acct-add-car-status');
    if (inp) inp.value = '';
    if (sta) sta.textContent = '';
  };

  window.acctGarageRemove = function (reg) {
    window.forgedGarage?.remove(reg);
    renderGarageTab();
  };

  async function addCarFormSubmit(e) {
    e.preventDefault();
    const input  = document.getElementById('acct-add-reg');
    const status = document.getElementById('acct-add-car-status');
    const submit = document.getElementById('acct-add-car-submit');
    const reg    = (input?.value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!reg) return;
    if (window.forgedGarage.get().find(c => c.reg === reg)) {
      status.textContent = 'Already in your garage.';
      return;
    }
    submit.textContent = 'Looking up...';
    submit.disabled    = true;
    status.textContent = '';
    try {
      const res  = await fetch('/api/vehicle-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber: reg }),
      });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || 'Vehicle not found. Check the reg.'; return; }
      window.forgedGarage.save({
        reg,
        make:   data.make   || '',
        model:  data.model  || '',
        year:   data.yearOfManufacture || data.manufactureYear || '',
        colour: data.colour || '',
      });
      acctGarageHideAdd();
      renderGarageTab();
    } catch {
      status.textContent = 'Lookup failed. Please try again.';
    } finally {
      submit.textContent = 'Add car';
      submit.disabled    = false;
    }
  }

  function nameFromEmail(email) {
    const local = (email || '').split('@')[0];
    const parts = local.split(/[._\-+]/).filter(Boolean);
    return parts.length > 1
      ? parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      : local.charAt(0).toUpperCase() + local.slice(1);
  }

  function renderDashboard(claims, orders) {
    const first  = claims.given_name  || '';
    const last   = claims.family_name || '';
    const name   = (first + ' ' + last).trim() || nameFromEmail(claims.email) || 'Your account';
    const initials = (first[0] || name[0] || '?').toUpperCase();

    document.getElementById('acct-avatar').textContent        = initials;
    document.getElementById('acct-name').textContent          = name;
    document.getElementById('acct-email').textContent         = claims.email || '';
    document.getElementById('acct-overview-name').textContent = name;
    document.getElementById('acct-overview-email').textContent = claims.email || '';

    if (['edencovell@gmail.com', 'mackinevahn11@gmail.com'].includes(claims.email)) {
      const btn = document.getElementById('acct-staff-btn');
      if (btn) btn.style.display = '';
    }

    const el = document.getElementById('acct-orders');
    el.innerHTML = orders && orders.length
      ? orders.map(renderOrder).join('')
      : `<p class="acct-empty">No orders yet. <a href="/shop">Browse the shop</a></p>`;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');

    if (code) {
      const savedVerifier = localStorage.getItem('pkce_v');
      if (!savedVerifier) {
        showError('Please open the sign-in link in the same browser you clicked Continue in.');
        return;
      }
      try {
        show('loading');
        const tokens = await exchangeCode(code);
        if (!tokens.id_token) {
          showError('Login failed: Shopify did not return an id_token. Response: ' + JSON.stringify(tokens));
          return;
        }
        localStorage.setItem('id_token', tokens.id_token);
        if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        showError('Login failed: ' + e.message);
        return;
      }
    }

    const idToken = localStorage.getItem('id_token');
    if (!idToken) { show('login'); return; }

    const claims = decodeJWT(idToken);
    if (!claims || !claims.email) {
      localStorage.removeItem('id_token');
      showError('Could not read account info. Please log in again.');
      return;
    }

    show('loading');

    let orders = [];
    if (idToken) {
      try {
        const cRes = await fetch('/api/customer', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: idToken }),
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          orders = cData.orders?.nodes || [];
        }
      } catch {}
    }

    renderDashboard(claims, orders);
    show('dashboard');
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    document.getElementById('acct-add-car-form')?.addEventListener('submit', addCarFormSubmit);
  });
})();
