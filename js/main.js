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

/* ── Mobile menu ── */
(function () {
  const btn    = document.getElementById('hamburger');
  const mobile = document.getElementById('mobile-nav');
  if (!btn || !mobile) return;
  btn.addEventListener('click', () => {
    const open = mobile.classList.toggle('open');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !mobile.contains(e.target)) {
      mobile.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
})();

/* ── Reveal on scroll ── */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
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

    submitBtn.textContent = 'Looking up…';
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

      const make  = data.make  || '—';
      const model = data.model || '';
      const year  = data.yearOfManufacture || data.manufactureYear || '';
      const fuel  = data.fuelType ? data.fuelType.charAt(0) + data.fuelType.slice(1).toLowerCase() : '';
      const colour = data.colour ? data.colour.charAt(0) + data.colour.slice(1).toLowerCase() : '';

      resultBox.innerHTML = `
        <div class="reg-result">
          <div class="reg-result-vehicle">
            <span class="reg-make">${make}</span>
            ${model ? `<span class="reg-model">${model}</span>` : ''}
            ${year   ? `<span class="reg-year">${year}</span>` : ''}
            ${colour ? `<span class="reg-trim">${colour}</span>` : ''}
            ${fuel   ? `<span class="reg-trim">${fuel}</span>` : ''}
          </div>
          <a href="shop.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}" class="btn btn-primary btn-sm">
            Shop products for your ${make}${model ? ' ' + model : ''}
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

/* ── Duplicate marquee for seamless loop ── */
(function () {
  const track = document.querySelector('.marquee-track');
  if (!track) return;
  track.innerHTML += track.innerHTML;
})();
