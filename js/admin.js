(function () {
  const STAFF_EMAILS = ['edencovell@gmail.com', 'mackinevahn11@gmail.com'];

  function decodeJWT(t) {
    try {
      const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p.padEnd(Math.ceil(p.length / 4) * 4, '=')));
    } catch { return null; }
  }

  function adminFetch(path) {
    return fetch(path, {
      headers: { Authorization: `Bearer ${localStorage.getItem('id_token')}` },
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error || `HTTP ${r.status}`); });
      return r.json();
    });
  }

  window.adminTab = function (tab, btn) {
    document.querySelectorAll('.admin-tab-panel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('admin-panel-' + tab).style.display = '';
    if (btn) btn.classList.add('active');
  };

  function fmt(val) { return '£' + parseFloat(val || 0).toFixed(2); }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusBadge(s) {
    const map = { paid: 'green', fulfilled: 'green', active: 'green', pending: 'yellow', unfulfilled: 'yellow', draft: 'yellow', refunded: 'red', 'partially_refunded': 'yellow' };
    const col = map[s] || 'grey';
    return `<span class="admin-badge admin-badge-${col}">${s || '—'}</span>`;
  }

  function renderStats(d) {
    document.getElementById('stat-orders').textContent    = d.totalOrders;
    document.getElementById('stat-revenue').textContent   = '£' + parseFloat(d.revenue30d).toFixed(2);
    document.getElementById('stat-customers').textContent = d.totalCustomers;
    document.getElementById('stat-products').textContent  = d.totalProducts;

    const orders = d.recentOrders || [];
    document.getElementById('admin-orders-body').innerHTML = orders.length
      ? orders.map(o => {
          const items = (o.line_items || []).slice(0, 2).map(i => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name).join(', ')
            + (o.line_items?.length > 2 ? ` +${o.line_items.length - 2} more` : '');
          return `<tr>
            <td class="admin-mono">${o.name}</td>
            <td>${o.email || '—'}</td>
            <td class="admin-muted">${items || '—'}</td>
            <td>${statusBadge(o.financial_status)}</td>
            <td>${statusBadge(o.fulfillment_status || 'unfulfilled')}</td>
            <td class="admin-mono">${fmt(o.total_price)}</td>
            <td class="admin-muted">${fmtDate(o.created_at)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" class="admin-empty">No orders yet</td></tr>';
  }

  function renderCustomers(d) {
    const customers = d.customers || [];
    document.getElementById('admin-customers-body').innerHTML = customers.length
      ? customers.map(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
          return `<tr>
            <td>${name}</td>
            <td>${c.email}</td>
            <td>${c.orders_count}</td>
            <td class="admin-mono">${fmt(c.total_spent)}</td>
            <td class="admin-muted">${fmtDate(c.created_at)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="admin-empty">No customers yet</td></tr>';
  }

  function renderProducts(d) {
    const products = d.products || [];
    const rows = [];
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        const title = p.variants.length > 1 ? `${p.title} — ${v.title}` : p.title;
        const qty   = v.inventory_quantity;
        const stockClass = qty > 10 ? 'green' : qty > 0 ? 'yellow' : 'red';
        const stockLabel = qty > 10 ? 'In stock' : qty > 0 ? 'Low stock' : 'Out of stock';
        rows.push(`<tr>
          <td>${title}</td>
          <td class="admin-mono">${fmt(v.price)}</td>
          <td>
            <div class="admin-stock-wrap">
              <input type="number" class="admin-stock-input" min="0" value="${qty}"
                data-orig="${qty}" id="si-${v.inventory_item_id}"
                oninput="adminStockChange(this,'${v.inventory_item_id}')">
              <button class="btn btn-xs btn-primary admin-stock-save" id="sb-${v.inventory_item_id}"
                style="display:none" onclick="adminSaveStock('${v.inventory_item_id}')">Save</button>
            </div>
          </td>
          <td><span class="admin-badge admin-badge-${stockClass}" id="sl-${v.inventory_item_id}">${stockLabel}</span></td>
        </tr>`);
      });
    });
    document.getElementById('admin-inventory-body').innerHTML = rows.length
      ? rows.join('')
      : '<tr><td colspan="4" class="admin-empty">No products yet. Add products in Shopify first.</td></tr>';
  }

  window.adminStockChange = function (input, itemId) {
    const saveBtn = document.getElementById('sb-' + itemId);
    if (saveBtn) saveBtn.style.display = input.value !== input.dataset.orig ? '' : 'none';
  };

  window.adminSaveStock = async function (itemId) {
    const input   = document.getElementById('si-' + itemId);
    const saveBtn = document.getElementById('sb-' + itemId);
    const qty     = parseInt(input.value, 10);
    if (isNaN(qty) || qty < 0) return;

    saveBtn.textContent = 'Saving…';
    saveBtn.disabled    = true;

    try {
      const r = await fetch('/api/admin/update-stock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('id_token')}` },
        body:    JSON.stringify({ inventoryItemId: itemId, quantity: qty }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }

      input.dataset.orig = qty;
      saveBtn.style.display = 'none';

      const label = document.getElementById('sl-' + itemId);
      if (label) {
        const cls = qty > 10 ? 'green' : qty > 0 ? 'yellow' : 'red';
        const txt = qty > 10 ? 'In stock' : qty > 0 ? 'Low stock' : 'Out of stock';
        label.className = `admin-badge admin-badge-${cls}`;
        label.textContent = txt;
      }
      toast('Stock updated on Shopify');
    } catch (e) {
      toast('Failed: ' + e.message, true);
    } finally {
      saveBtn.textContent = 'Save';
      saveBtn.disabled    = false;
    }
  };

  function toast(msg, err) {
    const el = document.getElementById('admin-toast');
    el.textContent = msg;
    el.className   = 'admin-toast' + (err ? ' admin-toast-err' : '');
    el.style.opacity = '1';
    el.style.display = '';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 300); }, 2800);
  }

  function showErr(msg) {
    document.getElementById('admin-loading').style.display = 'none';
    document.getElementById('admin-error').style.display = '';
    document.getElementById('admin-error-msg').textContent = msg;
  }

  window.adminLogout = function () { window.location.href = '/account'; };

  async function init() {
    const idToken = localStorage.getItem('id_token');
    if (!idToken) { window.location.href = '/account'; return; }

    const claims = decodeJWT(idToken);
    if (!claims || !STAFF_EMAILS.includes(claims.email)) { window.location.href = '/account'; return; }

    document.getElementById('admin-user-email').textContent = claims.email;

    try {
      const [statsData, customersData, productsData] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/customers'),
        adminFetch('/api/admin/products'),
      ]);
      renderStats(statsData);
      renderCustomers(customersData);
      renderProducts(productsData);
      document.getElementById('admin-loading').style.display  = 'none';
      document.getElementById('admin-dashboard').style.display = '';
    } catch (err) {
      showErr(err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
