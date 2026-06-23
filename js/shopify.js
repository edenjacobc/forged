/* =============================================
   FORGED — Shopify Storefront Integration
   ============================================= */

const SHOPIFY = {
  domain: 'forged-10046.myshopify.com',
  token:  'f16b69036e108ed1db6894a7b6537d41',
  api:    '2026-04'
};

/* ─── Configurable display constants ─────── */
const SUMMER_SALE_PCT      = 10;      // Summer sale discount % — also update announcement bar copy
const CARD_SKELETON_COUNT  = 8;       // Skeletons shown while products load
const PM_MAX_WIDTH         = '1100px'; // Product modal max-width (also update .pm-inner in CSS)

function sfEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Summer sale pricing ─────────────────── */
function computePricing(variant) {
  const orig = parseFloat(variant.price.amount);
  const compareAt = variant.compareAtPrice ? parseFloat(variant.compareAtPrice.amount) : null;
  if (compareAt && compareAt > orig) {
    return { salePrice: orig.toFixed(2), wasPrice: compareAt.toFixed(2) };
  }
  const sale = (orig * (1 - SUMMER_SALE_PCT / 100)).toFixed(2);
  return { salePrice: sale, wasPrice: orig.toFixed(2) };
}

function buildPriceHTML(variant) {
  const { salePrice, wasPrice } = computePricing(variant);
  return `£${salePrice} <span class="was">£${wasPrice}</span>`;
}

/* ─── Fetch all products via serverless function ── */
async function fetchProducts() {
  const res = await fetch('/api/shop-products');
  if (!res.ok) throw new Error('shop-products API ' + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.products || [];
}

/* ─── Badge from tags ─────────────────────── */
function getProductBadge(product) {
  const tags = (product.tags || []).map(t => t.toLowerCase());
  if (tags.includes('best-seller') || tags.includes('bestseller')) return 'Best Seller';
  if (tags.includes('new')) return 'New';
  return null;
}

function getCarbonBadge(product) {
  const tags = (product.tags || []).map(t => t.toLowerCase());
  const t = product.title.toLowerCase();
  if (tags.includes('authentic-carbon') || tags.includes('real-carbon')) return 'Carbon Fibre';
  if (t.includes('carbon')) return 'Synthetic Carbon';
  return null;
}

/* ─── Category classification ─────────────── */
const TECH_KEYWORDS     = ['air pump','compressor','tracking','tracker','heads up','speedometer','dash cam','dashcam','bluetooth'];
const INTERIOR_KEYWORDS = ['storage box','knob handle','knob','seat gap','gap filler','gear selector'];

function classifyProduct(product) {
  const t = product.title.toLowerCase();
  const pt = (product.productType || '').toLowerCase();

  if (pt.includes('tech'))     return { label: 'Tech',             filter: 'tech' };
  if (pt.includes('interior')) return { label: 'Interior Styling', filter: 'interior' };

  if (TECH_KEYWORDS.some(k => t.includes(k)))     return { label: 'Tech',             filter: 'tech' };
  if (INTERIOR_KEYWORDS.some(k => t.includes(k))) return { label: 'Interior Styling', filter: 'interior' };

  if (pt.includes('exterior')) return { label: 'Exterior Styling', filter: 'exterior' };
  return { label: 'Exterior Styling', filter: 'exterior' };
}

function getProductCategory(product) { return classifyProduct(product).label; }
function getFilterCategory(product)  { return classifyProduct(product).filter; }

/* ─── Base model extractor ────────────────── */
const KNOWN_MODELS = [
  'RS3','RS4','RS5','RS6','RS7','SQ5','SQ7',
  'S3','S4','S5','S6','S7','S8',
  'A1','A2','A3','A4','A5','A6','A7','A8',
  'Q2','Q3','Q5','Q7','Q8','R8','TT',
  'E-TRON','Q4','Q6',
  'GOLF','POLO','PASSAT','TIGUAN','T-ROC','TOUAREG','ARTEON',
];

function extractBaseModel(model) {
  const m = (model || '').toUpperCase().trim();
  for (const code of KNOWN_MODELS) {
    if (m === code || m.startsWith(code + ' ') || m.startsWith(code + '-') || m.startsWith(code + '/')) {
      return code;
    }
  }
  return m.split(' ')[0];
}

/* ─── Product type helpers ────────────────── */
function isAudiOnly(p) {
  const t = p.title.toLowerCase();
  return t.includes('knob') || t.includes('storage box') || t.includes('gear selector') || t.includes('gear shift');
}

function isShiftKnob(p) { return p.title.toLowerCase().includes('knob'); }

function isKeyCase(p) {
  const t = p.title.toLowerCase();
  return t.includes('key case') || t.includes('key cover') || t.includes('key fob') || t.includes('key shell');
}

function isPuddleLights(p) {
  const t = p.title.toLowerCase();
  return t.includes('welcome light') || t.includes('puddle light') || t.includes('puddle') ||
    (t.includes('audi') && t.includes('light') && !t.includes('ambient') && !t.includes('head'));
}

function isMirrorCaps(p) {
  const t = p.title.toLowerCase();
  return t.includes('mirror cap') || (t.includes('mirror') && (t.includes('cover') || t.includes('carbon')));
}

function isSeatGap(p) {
  const t = p.title.toLowerCase();
  return t.includes('seat gap') || t.includes('gap filler') || t.includes('seat filler');
}

/* ─── Puddle lights fitment ───────────────── */
const PUDDLE_LIGHTS_FITS = [
  { m:'A1',  from:2012, to:2012 },
  { m:'A1',  from:2014, to:2021 }, /* 2013 excluded */
  { m:'A3',  from:2010, to:2021 },
  { m:'A4',  from:2003, to:2021 },
  { m:'A5',  from:2008, to:2021 },
  { m:'A6',  from:2000, to:2021 },
  { m:'A7',  from:2012, to:2021 },
  { m:'A8',  from:2004, to:2021 },
  { m:'R8',  from:2007, to:2021 },
  { m:'Q3',  from:2012, to:2021 },
  { m:'Q5',  from:2010, to:2021 },
  { m:'Q7',  from:2006, to:2021 },
  { m:'RS3', from:2010, to:2017 },
  { m:'RS4', from:2010, to:2017 },
  { m:'RS5', from:2010, to:2017 },
  { m:'RS6', from:2010, to:2017 },
  { m:'S3',  from:2010, to:2017 },
  { m:'S4',  from:2010, to:2017 },
  { m:'S5',  from:2010, to:2017 },
  { m:'S6',  from:2010, to:2017 },
  { m:'S7',  from:2010, to:2017 },
  { m:'S8',  from:2010, to:2017 },
];

function isPuddleLightsFit(model, year) {
  const base = extractBaseModel(model);
  const y = parseInt(year, 10);
  if (!base || !y) return false;
  return PUDDLE_LIGHTS_FITS.some(f => base === f.m && y >= f.from && y <= f.to);
}

/* ─── Carbon mirror cap fitment (VW Golf Mk7) */
function isMirrorCapsFit(make, model, year) {
  const makeUp = (make || '').toUpperCase();
  if (makeUp !== 'VOLKSWAGEN' && makeUp !== 'VW') return false;
  const base = extractBaseModel(model);
  const y = parseInt(year, 10);
  return base === 'GOLF' && y >= 2013 && y <= 2020;
}

/* ─── Key cover compatibility ─────────────── */
const KEY_COVER_MODELS = ['A1','A3','A4','A5','A6','A7','A8','Q3','Q5','Q7','Q8'];

function isKeyCoverCompatible(model) {
  const base = extractBaseModel(model);
  return KEY_COVER_MODELS.includes(base);
}

/* Find best matching key cover variant index given make/model */
function getKeyCaseVariantIdx(variants, make, model) {
  const makeLow  = (make  || '').toLowerCase();
  const base     = extractBaseModel(model).toLowerCase();

  /* Try model match first (e.g. variant titled "A3 / A4" matches base "A3") */
  let idx = variants.findIndex(v => {
    const t = (v.title || '').toLowerCase();
    return base && (t.includes(base) || t.split(/[\s/,|]+/).some(part => part.trim() === base));
  });
  if (idx !== -1) return idx;

  /* Try make match */
  idx = variants.findIndex(v => {
    const t = (v.title || '').toLowerCase();
    if (makeLow === 'volkswagen') return t.includes('vw') || t.includes('volkswagen');
    if (makeLow === 'mercedes-benz' || makeLow === 'mercedes') return t.includes('mercedes');
    return t.includes(makeLow);
  });
  return idx;
}

/* ─── Compatibility filter ────────────────── */
function isCompatible(p, make, model, year) {
  const makeUp = (make || '').toUpperCase();
  const isAudi = makeUp === 'AUDI';
  const isVW   = makeUp === 'VOLKSWAGEN' || makeUp === 'VW';
  const isBMW  = makeUp === 'BMW';

  if (isAudiOnly(p))     return isAudi;
  if (isPuddleLights(p)) return isAudi && isPuddleLightsFit(model, year);
  if (isKeyCase(p))      return isAudi && isKeyCoverCompatible(model);
  if (isMirrorCaps(p))   return isMirrorCapsFit(make, model, year);
  if (isSeatGap(p))      return isAudi || isVW || isBMW;
  return true;
}

/* ─── Shift knob fitment ──────────────────── */
const SHIFT_KNOB_FITS = {
  F: [{ m:'A3',  from:2021, to:2023 }],
  E: [
    { m:'A6',  from:2020, to:2024 },
    { m:'A6L', from:2019, to:2024 },
    { m:'A7',  from:2019, to:2024 },
    { m:'A7L', from:2022, to:2024 },
    { m:'A8',  from:2019, to:2024 },
    { m:'A8L', from:2019, to:2024 },
    { m:'Q7',  from:2020, to:2024 },
  ],
  D: [
    { m:'Q7',  from:2017, to:2019 },
    { m:'A4',  from:2017, to:2024 },
    { m:'A4L', from:2017, to:2024 },
    { m:'A5',  from:2017, to:2024 },
    { m:'Q5',  from:2018, to:2024 },
    { m:'SQ5', from:2018, to:2024 },
  ],
  B: [
    { m:'A6',  from:2016, to:2018 },
    { m:'A6L', from:2016, to:2018 },
    { m:'A7',  from:2015, to:2018 },
  ],
  A: [
    { m:'A4',  from:2013, to:2016 },
    { m:'A4L', from:2013, to:2016 },
    { m:'A5',  from:2012, to:2016 },
    { m:'A6',  from:2013, to:2014 },
    { m:'A7',  from:2013, to:2014 },
    { m:'Q5',  from:2013, to:2018 },
    { m:'Q7',  from:2012, to:2015 },
    { m:'Q6L', from:2012, to:2015 },
    { m:'S6',  from:2013, to:2013 },
    { m:'S7',  from:2013, to:2013 },
  ],
};

function getShiftKnobType(model, year) {
  const base = extractBaseModel(model);
  const y = parseInt(year, 10);
  if (!base || !y) return null;
  for (const [type, fits] of Object.entries(SHIFT_KNOB_FITS)) {
    for (const f of fits) {
      const fm = f.m.toUpperCase();
      if ((base === fm || base + 'L' === fm) && y >= f.from && y <= f.to) return type;
    }
  }
  return null;
}

function findShiftKnobVariantIdx(variants, type) {
  const t = type.toUpperCase();
  return variants.findIndex(v => {
    const title = (v.title || '').toUpperCase();
    return title.startsWith(t + ' ') || title.startsWith(t + '/') || title.startsWith(t + '-') || title === t;
  });
}

/* ─── Product description fallback ───────── */
const FALLBACK_DESCRIPTIONS = {
  'welcome light': `<p>LED welcome lights for Audi. Projects a crisp logo onto the ground when you open the door — a clean upgrade that looks factory-fitted. Plug-and-play fit, no wiring required.</p><p>Compatible with: A1 (2012–2021, excl. 2013) · A3 (2010–2021) · A4 (2003–2021) · A5 (2008–2021) · A6 (2000–2021) · A7 (2012–2021) · A8 (2004–2021) · R8 (2007–2021) · Q3 (2012–2021) · Q5 (2010–2021) · Q7 (2006–2021) · RS3, RS4, RS5, RS6 (2010–2017) · S3–S8 (2010–2017). Please verify your model and year before ordering.</p>`,
  'audi key': `<p>ABS carbon fibre cover for your Audi key fob. Snaps directly onto your existing key — no tools, no adhesive, no fuss. Protects against daily wear and scuffs while adding a clean, premium look.</p><p>Compatible with Audi A1, A3, A4, A5, A6, A7, A8, Q3, Q5, Q7, Q8. Please compare with your current key before ordering — if it doesn't look like it will fit, it won't.</p>`,
  'key case': `<p>ABS carbon fibre key fob cover. Snaps directly onto your existing key — no tools, no adhesive. Protects against daily wear and scuffs while adding a clean, premium finish. Please compare with your current key before ordering — if it doesn't look like it will fit, it won't.</p>`,
  'key cover': `<p>ABS carbon fibre key fob cover. Snaps directly onto your existing key — no tools, no adhesive. Protects against daily wear and scuffs while adding a clean, premium finish. Please compare with your current key before ordering — if it doesn't look like it will fit, it won't.</p>`,
  'seat gap': `<p>Fills the gap between your seat and centre console — the one that swallows your phone, coins, and keys every single time. Slides in and stays put without adhesive or tools, keeping your interior clean and your belongings where you left them.</p><p>Built-in USB charging port keeps your devices topped up without cluttering the cabin. Available in multiple colours to suit your interior. 39.5cm length fits the majority of cars.</p><p>Sold as a pair — one for driver, one for passenger. Wipe-clean PU leather finish.</p>`,
};

function getProductDescription(product) {
  if (product.description && product.description.trim()) return product.description;
  const title = product.title.toLowerCase();
  const order = ['welcome light', 'audi key', 'key cover', 'key case', 'seat gap'];
  for (const key of order) {
    if (title.includes(key) && FALLBACK_DESCRIPTIONS[key]) return FALLBACK_DESCRIPTIONS[key];
  }
  return '';
}

/* ─── Skeleton loaders ────────────────────── */
function showSkeletons(grid) {
  grid.innerHTML = Array.from({ length: CARD_SKELETON_COUNT }, () => `
    <div class="product-skeleton">
      <div class="skeleton-img"></div>
      <div style="padding:14px 20px 18px;">
        <div class="skeleton-line" style="width:70%;height:13px;margin-bottom:8px;margin-left:0;margin-right:0;"></div>
        <div class="skeleton-line" style="width:42%;height:10px;margin-bottom:14px;margin-left:0;margin-right:0;"></div>
        <div class="skeleton-line" style="width:48%;height:14px;margin-left:0;margin-right:0;"></div>
      </div>
    </div>`).join('');
}

/* ─── Render product grid (shop page) ────── */
function buildCardHTML(p, i, filterCat) {
  const v0 = p.variants.nodes[0];
  const img = p.featuredImage?.url || '';
  const badge = getProductBadge(p);
  const carbonBadge = getCarbonBadge(p);
  const cat = getProductCategory(p);
  const hasOpts = p.variants.nodes.length > 1 && p.variants.nodes[0].title !== 'Default Title';
  const priceHTML = v0 ? buildPriceHTML(v0) : '£0.00';
  const staggerMs = Math.min(i, 7) * 55;

  return `
    <div class="product-card reveal" style="--reveal-delay:${staggerMs}ms"
         data-category="${sfEsc(filterCat)}" onclick="openProductModal(${i})">
      <div class="product-img">
        ${img
          ? `<img src="${sfEsc(img)}" alt="${sfEsc(p.title)}" loading="lazy">`
          : `<div class="product-img-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`}
        ${badge ? `<span class="product-badge">${sfEsc(badge)}</span>` : ''}
        ${carbonBadge ? `<span class="product-badge product-badge--carbon">${sfEsc(carbonBadge)}</span>` : ''}
        <span class="product-cat-tag">${sfEsc(cat)}</span>
      </div>
      <div class="product-body">
        <p class="product-name">${sfEsc(p.title)}</p>
        ${hasOpts ? '<p class="product-variants-hint">Multiple options</p>' : ''}
        <div class="product-price-row">
          <p class="product-price">${priceHTML}</p>
          <span class="product-card-arrow" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </div>
    </div>`;
}

function renderShopGrid(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const countEl = document.getElementById('shop-product-count');
  if (countEl) countEl.textContent = products.length + ' product' + (products.length !== 1 ? 's' : '');

  if (!products.length) {
    grid.innerHTML = '<p style="padding:60px;color:var(--grey-500);grid-column:1/-1;text-align:center;">No products found.</p>';
    return;
  }

  grid.innerHTML = products.map((p, i) => buildCardHTML(p, i, getFilterCategory(p))).join('');

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        // Reset stagger delay after reveal so hover transitions are instant
        const d = parseFloat(e.target.style.getPropertyValue('--reveal-delay')) || 0;
        setTimeout(() => e.target.style.setProperty('--reveal-delay', '0ms'), d + 950);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -10px 0px' });
  grid.querySelectorAll('.product-card.reveal').forEach(el => io.observe(el));

  const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter;
  if (activeFilter && activeFilter !== 'all') {
    grid.querySelectorAll('.product-card[data-category]').forEach(card => {
      card.style.display = card.dataset.category === activeFilter ? '' : 'none';
    });
  }
}

/* ─── Modal state ─────────────────────────── */
let _shopProducts  = [];
let _modalVariant  = null;
let _garageVehicle = null;

/* Renders product cards into any grid element.
   fitTagFn(product) => { label } | null for per-product fit badges. */
function renderProductCards(products, grid, fitTagFn) {
  if (!products.length) {
    grid.innerHTML = '<p style="padding:40px;color:var(--grey-500);grid-column:1/-1;text-align:center;">No products found.</p>';
    return;
  }
  grid.innerHTML = products.map((p, i) => {
    const idx = _shopProducts.indexOf(p);
    const v0 = p.variants.nodes[0];
    const img = p.featuredImage?.url || '';
    const badge = getProductBadge(p);
    const carbonBadge = getCarbonBadge(p);
    const cat = getProductCategory(p);
    const hasOpts = p.variants.nodes.length > 1 && p.variants.nodes[0].title !== 'Default Title';
    const priceHTML = v0 ? buildPriceHTML(v0) : '£0.00';
    const fit = fitTagFn ? fitTagFn(p) : null;
    const staggerMs = Math.min(i, 7) * 55;
    return `
      <div class="product-card reveal" style="--reveal-delay:${staggerMs}ms" onclick="openProductModal(${idx})">
        <div class="product-img">
          ${img ? `<img src="${sfEsc(img)}" alt="${sfEsc(p.title)}" loading="lazy">` : `<div class="product-img-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`}
          ${badge ? `<span class="product-badge">${sfEsc(badge)}</span>` : ''}
          ${carbonBadge ? `<span class="product-badge product-badge--carbon">${sfEsc(carbonBadge)}</span>` : ''}
          ${fit ? `<span class="garage-fit-tag${fit.cls === 'warn' ? ' garage-fit-tag--warn' : ''}">${sfEsc(fit.label)}</span>` : ''}
          <span class="product-cat-tag">${sfEsc(cat)}</span>
        </div>
        <div class="product-body">
          <p class="product-name">${sfEsc(p.title)}</p>
          ${hasOpts ? '<p class="product-variants-hint">Multiple options</p>' : ''}
          <div class="product-price-row">
            <p class="product-price">${priceHTML}</p>
            <span class="product-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </div>
      </div>`;
  }).join('');

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        const d = parseFloat(e.target.style.getPropertyValue('--reveal-delay')) || 0;
        setTimeout(() => e.target.style.setProperty('--reveal-delay', '0ms'), d + 950);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -10px 0px' });
  grid.querySelectorAll('.product-card.reveal').forEach(el => io.observe(el));
}

/* ─── Called after reg lookup (garage + home page) ── */
window.filterGarageProducts = function (make, model, year, reg) {
  _garageVehicle = { make, model, year, reg };

  const makeUp  = (make  || '').toUpperCase();
  const isAudi  = makeUp === 'AUDI';
  const isVW    = makeUp === 'VOLKSWAGEN' || makeUp === 'VW';
  const isBMW   = makeUp === 'BMW';
  const knobType = isAudi ? getShiftKnobType(model, year) : null;
  function hasSpecificFit(p) {
    if (isAudiOnly(p))     return isAudi;
    if (isPuddleLights(p)) return isAudi;
    if (isKeyCase(p))      return isAudi;
    if (isMirrorCaps(p))   return isVW;
    if (isSeatGap(p))      return isAudi || isVW || isBMW;
    return false;
  }

  const compatible = _shopProducts
    .filter(p => isCompatible(p, make, model, year))
    .sort((a, b) => (hasSpecificFit(b) ? 1 : 0) - (hasSpecificFit(a) ? 1 : 0));

  const fitTagFn = p => {
    if (isShiftKnob(p) && isAudi) {
      return knobType ? { label: `Type ${knobType} Fit` } : null;
    }
    if (isAudiOnly(p) && isAudi)     return { label: 'Fits your Audi' };
    if (isPuddleLights(p) && isAudi) return { label: 'Fits your Audi' };
    if (isKeyCase(p) && isAudi)      return { label: 'Verify key shape', cls: 'warn' };
    if (isMirrorCaps(p) && isVW)     return { label: 'Fits your Golf' };
    if (isSeatGap(p) && (isAudi || isVW || isBMW)) return { label: `Fits your ${make}` };
    return null;
  };

  /* ── Garage page UI ── */
  const vehicleCard = document.getElementById('garage-vehicle-card');
  if (vehicleCard) {
    vehicleCard.innerHTML = `
      <div class="garage-vehicle-info">
        <div class="garage-vehicle-make">${sfEsc(make || '')}</div>
        <div class="garage-vehicle-model">${sfEsc(model || '')}</div>
        ${year ? `<div class="garage-vehicle-detail"><span>${sfEsc(year)}</span></div>` : ''}
      </div>
      <div class="garage-reg-plate">${sfEsc((reg || '').toUpperCase())}</div>`;
  }

  const defaultSection = document.getElementById('default-products');
  const filteredSection = document.getElementById('garage-products');
  if (defaultSection) defaultSection.style.display = 'none';
  if (filteredSection) filteredSection.style.display = '';

  const heading = document.getElementById('garage-fit-heading');
  if (heading) heading.textContent = `Products for your ${[make, model].filter(Boolean).join(' ')}`;

  const garageGrid = document.getElementById('garage-products-grid');
  if (garageGrid) renderProductCards(compatible, garageGrid, fitTagFn);

  /* ── Home page UI ── */
  const homeGrid = document.getElementById('home-products-grid');
  if (homeGrid) {
    const section = homeGrid.closest('.products-section');
    if (section) {
      const label = section.querySelector('.section-label');
      const title = section.querySelector('.section-title');
      if (label) label.textContent = `For your ${make}${model ? ' ' + model : ''}`;
      if (title) title.textContent = 'Products that fit.';
    }
    renderProductCards(compatible.slice(0, 8), homeGrid, fitTagFn);
    setTimeout(() => {
      const section = homeGrid.closest('.products-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
};

/* ─── Open product modal ──────────────────── */
window.openProductModal = function (idx) {
  const product = _shopProducts[idx];
  if (!product) return;

  const variants = product.variants.nodes;
  const hasOpts = variants.length > 1 && variants[0].title !== 'Default Title';
  _modalVariant = variants[0];

  const images = product.images.nodes.length ? product.images.nodes : (product.featuredImage ? [product.featuredImage] : []);
  const badge = getProductBadge(product);
  const v = _modalVariant;
  const priceHTML = v ? buildPriceHTML(v) : '£0.00';
  const description = getProductDescription(product);

  const content = document.getElementById('pm-content');
  if (!content) return;
  content._product = product;

  const { salePrice: salePriceVal, wasPrice: wasPriceVal } = v ? computePricing(v) : { salePrice: '0.00', wasPrice: '0.00' };
  const savingsAmt = (parseFloat(wasPriceVal) - parseFloat(salePriceVal)).toFixed(2);
  const showSaleTag = parseFloat(savingsAmt) > 0;

  content.innerHTML = `
    <div class="pm-gallery">
      <div class="pm-main-img">
        ${images.length
          ? `<img src="${sfEsc(images[0].url)}" alt="${sfEsc(product.title)}" id="pm-img-el">`
          : `<div class="pm-img-placeholder"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`}
        ${badge ? `<span class="product-badge pm-badge">${sfEsc(badge)}</span>` : ''}
      </div>
      ${images.length > 1 ? `<div class="pm-thumbs">${
        images.map((im, i) => `<button class="pm-thumb${i === 0 ? ' active' : ''}" onclick="pmSelectImage(${i})" style="background-image:url('${sfEsc(im.url)}')"></button>`).join('')
      }</div>` : ''}
    </div>
    <div class="pm-info">
      <p class="product-category">${sfEsc(getProductCategory(product))}</p>
      <h2 class="pm-title">${sfEsc(product.title)}</h2>
      <p class="pm-price" id="pm-price">${priceHTML}</p>
      ${showSaleTag ? `<div class="pm-sale-row">
        <span class="pm-sale-tag"><i class="fa-solid fa-tag"></i> Summer Sale ${SUMMER_SALE_PCT}% off</span>
        <span class="pm-save-amount">You save £${savingsAmt}</span>
      </div>` : ''}
      ${hasOpts ? (variants.length > 5
        ? `<div class="pm-variants">
            <p class="pm-label">Option</p>
            <select class="pm-select" onchange="pmSelectVariant(this.value)">
              ${variants.map((vv, i) => `<option value="${i}"${!vv.availableForSale ? ' disabled' : ''}>${sfEsc(vv.title)}${!vv.availableForSale ? ' — Sold out' : ''}</option>`).join('')}
            </select>
          </div>`
        : `<div class="pm-variants">
            <p class="pm-label">Option</p>
            <div class="pm-pills">
              ${variants.map((vv, i) => `<button class="pm-pill${i === 0 ? ' active' : ''}${!vv.availableForSale ? ' pm-pill-sold' : ''}" onclick="pmSelectVariant(${i})">${sfEsc(vv.title)}</button>`).join('')}
            </div>
          </div>`)
        : ''}
      ${description ? `<div class="pm-desc-wrap">
        <div class="pm-desc" id="pm-desc" style="max-height:110px;overflow:hidden;transition:max-height 0.42s cubic-bezier(0.25,1,0.5,1);">${description}</div>
        <div class="pm-desc-gradient" id="pm-desc-gradient"></div>
        <button class="pm-desc-toggle" id="pm-desc-toggle" onclick="pmToggleDesc()">Show more <i class="fa-solid fa-chevron-down"></i></button>
      </div>` : ''}
      <div class="pm-shipping">
        <div class="pm-ship-row"><i class="fa-solid fa-truck"></i><span>Free UK delivery on orders over £50</span></div>
        <div class="pm-ship-row"><i class="fa-regular fa-clock"></i><span>Standard delivery: 7–14 days</span></div>
        <div class="pm-ship-row"><i class="fa-solid fa-rotate-left"></i><span>30-day hassle-free returns</span></div>
      </div>
      <button class="btn btn-primary btn-lg pm-atc" onclick="pmAddToCart()">
        <i class="fa-solid fa-bag-shopping"></i> Add to cart
      </button>
    </div>`;

  /* Pre-select correct variant from garage/reg lookup context */
  if (_garageVehicle && hasOpts) {
    const { make: gMake, model: gModel, year: gYear } = _garageVehicle;
    if (isShiftKnob(product)) {
      const knobType = getShiftKnobType(gModel, gYear);
      if (knobType) {
        const typeIdx = findShiftKnobVariantIdx(variants, knobType);
        if (typeIdx !== -1) pmSelectVariant(typeIdx);
      }
    } else if (isKeyCase(product) || isPuddleLights(product)) {
      /* Try to match a variant by base model name (e.g. "A3") */
      const keyIdx = getKeyCaseVariantIdx(variants, gMake, gModel);
      if (keyIdx !== -1) pmSelectVariant(keyIdx);
    }
  }

  /* Populate sticky mobile ATC bar */
  const atcBar = document.getElementById('pm-atc-bar');
  if (atcBar) {
    atcBar.innerHTML = `
      <div class="pm-atc-bar-price-wrap">
        <p class="pm-atc-bar-label">Price</p>
        <p class="pm-atc-bar-price">${priceHTML}</p>
      </div>
      <button class="btn btn-primary btn-lg pm-atc-bar-btn" onclick="pmAddToCart()">
        <i class="fa-solid fa-bag-shopping"></i> Add to cart
      </button>`;
  }

  document.getElementById('product-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    const descEl = document.getElementById('pm-desc');
    const btnEl  = document.getElementById('pm-desc-toggle');
    const gradEl = document.getElementById('pm-desc-gradient');
    if (descEl && btnEl && descEl.scrollHeight <= 114) {
      btnEl.style.display = 'none';
      if (gradEl) gradEl.style.display = 'none';
      descEl.style.maxHeight = 'none';
    }
  });
};

window.closeProductModal = function () {
  document.getElementById('product-modal')?.classList.remove('open');
  document.body.style.overflow = '';
};

window.pmSelectImage = function (idx) {
  const product = document.getElementById('pm-content')?._product;
  const images = product?.images?.nodes;
  if (!images || !images[idx]) return;
  const el = document.getElementById('pm-img-el');
  if (el) {
    el.style.opacity = '0';
    const newSrc = images[idx].url;
    const onLoad = () => { el.style.opacity = '1'; el.removeEventListener('load', onLoad); };
    el.addEventListener('load', onLoad);
    setTimeout(() => { el.src = newSrc; }, 130);
  }
  document.querySelectorAll('.pm-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
};

window.pmSelectVariant = function (idx) {
  idx = parseInt(idx, 10);
  const product = document.getElementById('pm-content')?._product;
  if (!product) return;
  const v = product.variants.nodes[idx];
  if (!v) return;
  _modalVariant = v;

  const priceEl = document.getElementById('pm-price');
  if (priceEl) priceEl.innerHTML = buildPriceHTML(v);

  const barPrice = document.querySelector('#pm-atc-bar .pm-atc-bar-price');
  if (barPrice) barPrice.innerHTML = buildPriceHTML(v);

  document.querySelectorAll('.pm-pill').forEach((p, i) => p.classList.toggle('active', i === idx));
  const sel = document.querySelector('.pm-select');
  if (sel) sel.value = idx;

  if (v.imageId) {
    const imgIdx = product.images.nodes.findIndex(im => im.shopifyId === v.imageId);
    if (imgIdx !== -1) pmSelectImage(imgIdx);
  }
};

window.pmToggleDesc = function () {
  const desc = document.getElementById('pm-desc');
  const btn  = document.getElementById('pm-desc-toggle');
  const grad = document.getElementById('pm-desc-gradient');
  if (!desc || !btn) return;

  if (desc.style.maxHeight === 'none') {
    desc.style.maxHeight = desc.scrollHeight + 'px';
    desc.offsetHeight;
    requestAnimationFrame(() => {
      desc.style.maxHeight = '110px';
      if (grad) grad.style.opacity = '1';
      btn.innerHTML = 'Show more <i class="fa-solid fa-chevron-down"></i>';
    });
  } else {
    desc.style.maxHeight = desc.scrollHeight + 'px';
    if (grad) grad.style.opacity = '0';
    btn.innerHTML = 'Show less <i class="fa-solid fa-chevron-up"></i>';
    desc.addEventListener('transitionend', function h() {
      desc.style.maxHeight = 'none';
      desc.removeEventListener('transitionend', h);
    });
  }
};

window.pmAddToCart = function () {
  const product = document.getElementById('pm-content')?._product;
  if (!product || !_modalVariant) return;
  const v = _modalVariant;
  const { salePrice } = computePricing(v);
  const img = product.featuredImage?.url || '';
  const variantTitle = v.title !== 'Default Title' ? v.title : '';
  const displayName = variantTitle ? `${product.title} — ${variantTitle}` : product.title;
  addToCart(v.id, displayName, parseFloat(salePrice), getProductCategory(product), img, variantTitle);
  closeProductModal();
};

/* ─── Checkout — auto-apply summer sale code ──
 * Redirect to Shopify's /cart/VARIANT_ID:QTY URL with SUMMER10 discount.
 * ─────────────────────────────────────────── */
window.shopifyCheckout = function () {
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('forged_cart') || '[]'); } catch {}
  if (!cart.length) return;

  const items = cart
    .filter(item => item.id && item.id.startsWith('gid://shopify/ProductVariant/'))
    .map(item => {
      const numId = item.id.replace('gid://shopify/ProductVariant/', '');
      return `${numId}:${item.qty}`;
    });

  if (!items.length) { cartCheckoutEmail(); return; }

  const btn = document.querySelector('.cart-checkout-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Redirecting...'; }

  window.location.href = `https://${SHOPIFY.domain}/cart/${items.join(',')}?discount=SUMMER10`;
};

/* ─── Init ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function () {
  document.getElementById('product-modal')?.addEventListener('click', function (e) {
    if (e.target === this) closeProductModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProductModal(); });

  const shopGrid   = document.getElementById('products-grid');
  const homeGrid   = document.getElementById('home-products-grid');
  const garageGrid = document.getElementById('garage-all-grid');
  if (!shopGrid && !homeGrid && !garageGrid) return;

  if (shopGrid)   showSkeletons(shopGrid);
  if (homeGrid)   showSkeletons(homeGrid);
  if (garageGrid) showSkeletons(garageGrid);

  try {
    const products = await fetchProducts();
    _shopProducts = products;

    if (shopGrid)   renderShopGrid(products);
    if (homeGrid)   renderProductCards(products.slice(0, 4), homeGrid, null);
    if (garageGrid) renderProductCards(products, garageGrid, null);
  } catch (err) {
    console.error('[Forged] Failed to load products:', err);
    const errMsg = '<p style="padding:60px;color:var(--grey-500);grid-column:1/-1;text-align:center;">Could not load products. Please refresh and try again.</p>';
    if (shopGrid)   shopGrid.innerHTML   = errMsg;
    if (homeGrid)   homeGrid.innerHTML   = errMsg;
    if (garageGrid) garageGrid.innerHTML = errMsg;
  }
});
