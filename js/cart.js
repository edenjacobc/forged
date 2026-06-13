/* =============================================
   FORGED — Cart
   ============================================= */
(function () {
  'use strict';

  const KEY = 'forged_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function saveCart(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    syncAll();
  }

  /* ── Actions ── */
  window.addToCart = function (id, name, price, category) {
    const cart = getCart();
    const existing = cart.find(i => i.id === id);
    if (existing) { existing.qty++; }
    else { cart.push({ id, name, price: Number(price), category: category || '', qty: 1 }); }
    saveCart(cart);
    openCart();
  };

  window.cartRemove = function (id) { saveCart(getCart().filter(i => i.id !== id)); };

  window.cartQty = function (id, delta) {
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) { saveCart(cart.filter(i => i.id !== id)); return; }
    saveCart(cart);
  };

  window.clearCart = function () { saveCart([]); };

  /* ── Drawer ── */
  window.openCart = function () {
    document.getElementById('cart-overlay')?.classList.add('open');
    document.getElementById('cart-drawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCart();
  };

  window.closeCart = function () {
    document.getElementById('cart-overlay')?.classList.remove('open');
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ── Render ── */
  function renderCart() {
    const listEl   = document.getElementById('cart-items-list');
    const footerEl = document.getElementById('cart-drawer-footer');
    const totalEl  = document.getElementById('cart-total');
    const countEl  = document.getElementById('cart-drawer-count');
    if (!listEl) return;

    const cart  = getCart();
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count = cart.reduce((s, i) => s + i.qty, 0);

    if (countEl) countEl.textContent = count + ' item' + (count !== 1 ? 's' : '');
    if (totalEl) totalEl.textContent = '£' + total.toFixed(2);
    if (footerEl) footerEl.style.display = cart.length ? '' : 'none';

    if (cart.length === 0) {
      listEl.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn-outline btn-sm" onclick="closeCart()" style="margin-top:8px;">Browse products</a>
        </div>`;
      return;
    }

    listEl.innerHTML = cart.map(item => `
      <div class="cart-item-row">
        <div class="cart-item-img">
          ${item.img ? `<img src="${item.img}" alt="${esc(item.name)}">` : ''}
        </div>
        <div class="cart-item-details">
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-meta">${esc(item.category)}</div>
          <div class="cart-item-controls">
            <button class="cart-qty-btn" onclick="cartQty('${item.id}',-1)"><i class="fa-solid fa-minus" style="font-size:9px;"></i></button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn" onclick="cartQty('${item.id}',1)"><i class="fa-solid fa-plus" style="font-size:9px;"></i></button>
          </div>
          <button class="cart-item-remove" onclick="cartRemove('${item.id}')">Remove</button>
        </div>
        <div class="cart-item-price">£${(item.price * item.qty).toFixed(2)}</div>
      </div>`).join('');
  }

  function syncAll() { renderCart(); updateBadges(); }

  function updateBadges() {
    const count = getCart().reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  /* ── Checkout ── */
  window.cartCheckoutEmail = function () {
    const cart = getCart();
    if (!cart.length) return;
    const lines = cart.map(i => `• ${i.qty}x ${i.name} — £${(i.price * i.qty).toFixed(2)}`).join('\n');
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const body = `Hi,\n\nI'd like to order:\n\n${lines}\n\nOrder total: £${total.toFixed(2)}\n\nPlease confirm and send payment details. Thanks`;
    window.location.href = 'mailto:hello@forged.co.uk?subject=Order%20Enquiry&body=' + encodeURIComponent(body);
  };

  /* ── Toast ── */
  window.showToast = function (msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast'; toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2800);
  };

  /* ── Helpers ── */
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    updateBadges();
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  });

})();
