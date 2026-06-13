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
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => io.observe(el));
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

      resultBox.innerHTML = `
        <div class="reg-result">
          <div class="reg-result-vehicle">
            <span class="reg-make">${make}</span>
            ${model  ? `<span class="reg-model">${model}</span>`  : ''}
            ${year   ? `<span class="reg-year">${year}</span>`    : ''}
            ${colour ? `<span class="reg-trim">${colour}</span>`  : ''}
            ${fuel   ? `<span class="reg-trim">${fuel}</span>`    : ''}
          </div>
          <a href="shop.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}"
             class="btn btn-primary btn-sm">
            Shop for your ${make}${model ? ' ' + model : ''}
          </a>
        </div>`;

    } catch {
      resultBox.innerHTML = `<p class="reg-error">Something went wrong. Please try again.</p>`;
    } finally {
      submitBtn.textContent = 'Find My Car';
      submitBtn.disabled = false;
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
      document.querySelectorAll('.product-card[data-category]').forEach(card => {
        card.style.display = (category === 'all' || card.dataset.category === category) ? '' : 'none';
      });
    });
  });
})();
