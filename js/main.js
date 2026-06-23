/* =============================================
   FORGED — Main JS
   ============================================= */

/* ── Navbar scroll state ── */
(function () {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
})();

/* ── Mobile menu with X animation ── */
(function () {
  const btn    = document.getElementById('hamburger');
  const mobile = document.getElementById('mobile-nav');
  if (!btn || !mobile) return;

  btn.addEventListener('click', () => {
    const open = mobile.classList.toggle('open');
    btn.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !mobile.contains(e.target)) {
      mobile.classList.remove('open');
      btn.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
})();

/* ── Scroll reveal (supports reveal, reveal-left, reveal-right, reveal-scale) ── */
(function () {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!els.length) return;

  function showAll() { els.forEach(el => el.classList.add('visible')); }

  if (!('IntersectionObserver' in window)) { showAll(); return; }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
  els.forEach(el => io.observe(el));

  // Fallback: if IO never fires (some WebViews), show everything after 3s
  setTimeout(showAll, 3000);
})();

/* ── Custom animated dropdown ── */
(function () {
  const selects = document.querySelectorAll('.custom-select');
  selects.forEach(sel => {
    const trigger    = sel.querySelector('.custom-select-trigger');
    const options    = sel.querySelectorAll('.custom-select-option');
    const textEl     = sel.querySelector('.custom-select-trigger-text');
    const iconEl     = sel.querySelector('.custom-select-trigger-icon');
    const hiddenInput = sel.querySelector('input[type="hidden"]');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isOpen = sel.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', e => {
      if (!sel.contains(e.target)) {
        sel.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        const val   = opt.dataset.value;
        const title = opt.querySelector('.custom-select-option-title').textContent;
        const icon  = opt.querySelector('.custom-select-option-icon').innerHTML;

        if (textEl) textEl.textContent = title;
        if (iconEl) iconEl.innerHTML = icon;
        if (hiddenInput) hiddenInput.value = val;

        sel.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });
  });
})();

/* ── Saved garage cars (shared across pages) ── */
window.forgedGarage = (function () {
  const KEY = 'forged_garage';
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function set(cars) { localStorage.setItem(KEY, JSON.stringify(cars)); }
  return {
    get,
    save: function (car) {
      const cars = get();
      if (!cars.find(c => c.reg === car.reg)) { cars.push(car); set(cars); }
    },
    remove: function (reg) { set(get().filter(c => c.reg !== reg)); },
  };
})();

window.garageSaveCar = function (btn) {
  if (!btn) return;
  window.forgedGarage.save({
    reg:    btn.dataset.reg,
    make:   btn.dataset.make,
    model:  btn.dataset.model,
    year:   btn.dataset.year,
    colour: btn.dataset.colour,
  });
  btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved to garage';
  btn.disabled = true;
  window.renderSavedCars?.();
};

/* ── Reg lookup ── */
(function () {
  const form      = document.getElementById('reg-form');
  const input     = document.getElementById('reg-input');
  const submitBtn = document.getElementById('reg-submit');
  const resultBox = document.getElementById('reg-result');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const reg = (input.value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!reg) return;

    submitBtn.textContent = 'Looking up...';
    submitBtn.disabled = true;
    resultBox.innerHTML = '';

    try {
      const res = await fetch('/api/vehicle-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber: reg })
      });

      const data = await res.json();

      if (!res.ok) {
        resultBox.innerHTML = `<p class="reg-error">${data.error || 'Vehicle not found. Check the reg and try again.'}</p>`;
        return;
      }

      const make   = data.make  || 'Unknown';
      const model  = data.model || '';
      const year   = data.yearOfManufacture || data.manufactureYear || '';
      const fuel   = data.fuelType  ? data.fuelType.charAt(0) + data.fuelType.slice(1).toLowerCase()  : '';
      const colour = data.colour    ? data.colour.charAt(0) + data.colour.slice(1).toLowerCase()       : '';
      const isSaved = window.forgedGarage.get().some(c => c.reg === reg);
      function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }

      resultBox.innerHTML = `
        <div class="reg-result">
          <div class="reg-result-vehicle">
            <span class="reg-make">${make}</span>
            ${model  ? `<span class="reg-model">${model}</span>`  : ''}
            ${year   ? `<span class="reg-year">${year}</span>`    : ''}
            ${colour ? `<span class="reg-trim">${colour}</span>`  : ''}
            ${fuel   ? `<span class="reg-trim">${fuel}</span>`    : ''}
          </div>
          <div class="reg-result-actions">
            <a href="/shop?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}"
               class="btn btn-primary btn-sm">
              Shop for your ${make}${model ? ' ' + model : ''}
            </a>
            <button class="btn btn-outline btn-sm garage-save-btn"
                    data-reg="${esc(reg)}" data-make="${esc(make)}" data-model="${esc(model)}"
                    data-year="${esc(year)}" data-colour="${esc(colour)}"
                    onclick="garageSaveCar(this)"
                    ${isSaved ? 'disabled' : ''}>
              ${isSaved
                ? '<i class="fa-solid fa-check"></i> In My Garage'
                : '<i class="fa-solid fa-plus"></i> Save to My Garage'}
            </button>
          </div>
        </div>`;

      document.dispatchEvent(new CustomEvent('forged:reg-result', {
        detail: { make, model, year, colour, fuel, reg }
      }));

    } catch {
      resultBox.innerHTML = `<p class="reg-error">Something went wrong. Please try again.</p>`;
    } finally {
      submitBtn.textContent = 'Find My Car';
      submitBtn.disabled = false;
    }
  });
})();

/* ── Home page: filter products after reg lookup ── */
(function () {
  if (!document.getElementById('home-products-grid')) return;
  document.addEventListener('forged:reg-result', function (e) {
    const { make, model, year, reg } = e.detail;
    if (make && make !== 'Unknown') {
      window.filterGarageProducts(make, model, year, reg);
    }
  });
})();

/* ── Shop page filter ── */
(function () {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.dataset.filter;
      const grid = document.getElementById('products-grid');
      if (grid) grid.classList.add('grid-filtering');
      setTimeout(() => {
        let visible = 0;
        document.querySelectorAll('.product-card[data-category]').forEach(card => {
          const show = category === 'all' || card.dataset.category === category;
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        if (grid) grid.classList.remove('grid-filtering');
        const countEl = document.getElementById('shop-product-count');
        if (countEl && visible > 0) {
          countEl.textContent = visible + ' product' + (visible !== 1 ? 's' : '');
        }
      }, 160);
    });
  });
})();
