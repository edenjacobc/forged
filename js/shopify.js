/* =============================================
   FORGED — Shopify Storefront Integration
   ============================================= */

const SHOPIFY = {
  domain: 'forged-10046.myshopify.com',
  token:  'f16b69036e108ed1db6894a7b6537d41',
  api:    '2024-01'
};

/* ─── Product → Shopify variant ID map ───────
 * How to fill these in once you add products:
 *   Shopify Admin → Products → click a product
 *   → scroll to Variants → the ID is in the URL
 *     when you click a variant: ?variant=XXXXXXXXXX
 *   Paste as: 'gid://shopify/ProductVariant/XXXXXXXXXX'
 * ─────────────────────────────────────────── */
const VARIANTS = {
  'wireless-carplay':     null,   // Wireless CarPlay Adapter      £89.99
  'audi-s-badge':         null,   // Audi S Badge Set               £19.99
  'bmw-m-badge':          null,   // BMW M Badge Set                £19.99
  'carbon-mirror-caps':   null,   // Carbon Fibre Mirror Caps       £34.99
  'shift-paddles':        null,   // Aluminium Shift Paddles        £44.99
  'seat-belt-pads':       null,   // Seat Belt Shoulder Pads        £14.99
  'phone-mount':          null,   // Magnetic Phone Mount           £24.99
  'plate-frame':          null,   // Custom Plate Frame             £12.99
  'dash-cam':             null,   // Dash Cam Pro                   £79.99
  'air-freshener':        null,   // Premium Air Freshener           £9.99
  'boot-mat':             null,   // Boot Mat                       £29.99
  'car-cover':            null,   // Indoor Car Cover               £59.99
  'sunshade':             null,   // Windscreen Sunshade            £16.99
  'steering-wheel-cover': null,   // Steering Wheel Cover           £22.99
  'led-interior-kit':     null,   // LED Interior Kit               £18.99
};

/* ─── Checkout ───────────────────────────────
 * Called from the cart drawer checkout button.
 * Sends cart items to Shopify and redirects to
 * their hosted checkout. Falls back to email if
 * no variant IDs are mapped yet.
 * ─────────────────────────────────────────── */
window.shopifyCheckout = async function () {
  const cart = JSON.parse(localStorage.getItem('forged_cart') || '[]');
  if (!cart.length) return;

  const lines = cart
    .filter(item => VARIANTS[item.id])
    .map(item => ({ merchandiseId: VARIANTS[item.id], quantity: item.qty }));

  if (!lines.length) {
    /* No variant IDs mapped yet — fall back to email until products are added */
    cartCheckoutEmail();
    return;
  }

  const btn = document.querySelector('.cart-checkout-btn');
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Redirecting…'; }

  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }
  `;

  try {
    const res = await fetch(
      `https://${SHOPIFY.domain}/api/${SHOPIFY.api}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY.token
        },
        body: JSON.stringify({ query: mutation, variables: { input: { lines } } })
      }
    );

    const json = await res.json();
    const errors    = json?.data?.cartCreate?.userErrors;
    const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;

    if (errors?.length) {
      console.error('[Forged] Shopify cart error:', errors);
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
      cartCheckoutEmail();
      return;
    }

    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }

  } catch (err) {
    console.error('[Forged] Shopify checkout failed:', err);
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    cartCheckoutEmail();
  }
};
