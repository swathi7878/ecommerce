// ============================================================
//  public/app.js  —  ShopEasy Shared Utilities
//
//  Every HTML page loads this file FIRST via <script src="app.js">
//  then runs its own inline <script>. This file exposes the shared
//  global functions that those inline scripts call:
//
//  Called by ALL pages:
//    updateCartBadge()
//    logout()
//
//  Called by index.html (via onclick in rendered product cards):
//    addToCart(id, name, price, image)
//
//  Called by cart.html (inline script):
//    getCart()
//    saveCart(cart)
//
//  Everything else (loadProducts, placeOrder, loadOrders, etc.)
//  is already fully implemented in each page's own inline script.
// ============================================================


// ── CART HELPERS ─────────────────────────────────────────────

/**
 * Read and return the cart array from localStorage.
 * Returns an empty array if nothing is stored or if the data is corrupted.
 * Called by: cart.html inline script (getCart(), changeQty(), removeFromCart(), placeOrder())
 */
function getCart() {
  try {
    const raw = localStorage.getItem('cart');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    // If JSON is somehow corrupted, reset to empty cart
    localStorage.removeItem('cart');
    return [];
  }
}

/**
 * Write the cart array to localStorage.
 * Called by: cart.html inline script (saveCart(cart) in changeQty, removeFromCart, placeOrder)
 * @param {Array} cart - Array of cart item objects { id, name, price, image, qty }
 */
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

/**
 * Add a product to the cart, or increment its quantity if it already exists.
 * Shows a toast notification confirming the addition.
 *
 * Called by: index.html via onclick on each rendered product button:
 *   onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image}')"
 *
 * @param {string} id    - Product ID from the backend
 * @param {string} name  - Product display name
 * @param {number} price - Product price in ₹
 * @param {string} image - Product emoji icon
 */
function addToCart(id, name, price, image) {
  const cart = getCart();
  const existingIndex = cart.findIndex(function(item) { return item.id === id; });

  if (existingIndex !== -1) {
    // Product already in cart — just increase quantity
    cart[existingIndex].qty += 1;
  } else {
    // New product — add it with qty of 1
    cart.push({ id: id, name: name, price: price, image: image, qty: 1 });
  }

  saveCart(cart);
  updateCartBadge();
  showToast('🛒 "' + name + '" added to cart!');
}

/**
 * Update the cart item count badge shown in the navbar.
 * The badge element id is "cartCount" — present on index, cart, orders pages.
 * Called by: every page's updateNav() and directly by auth.html after load.
 */
function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return; // admin.html has no cart badge — that's fine

  const cart = getCart();
  const totalItems = cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
  badge.textContent = totalItems;
}


// ── AUTH HELPER ───────────────────────────────────────────────

/**
 * Log the current user out:
 *   1. Call POST /api/logout to invalidate the server-side token.
 *   2. Remove all auth keys from localStorage.
 *   3. Redirect to auth.html.
 *
 * Called by: every page's Logout button via onclick="logout()"
 * Backend route: POST /api/logout  (requires Authorization header)
 */
async function logout() {
  const token = localStorage.getItem('token');

  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': token
        }
      });
    } catch (e) {
      // Network error or server down — continue with local cleanup regardless
    }
  }

  // Always clear local storage, even if the server call failed
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');

  window.location.href = 'auth.html';
}


// ── UI UTILITY ────────────────────────────────────────────────

/**
 * Show a brief toast notification at the bottom-right of the screen.
 * Automatically disappears after 2.5 seconds.
 * Used internally by addToCart() to confirm items were added.
 *
 * @param {string} message - The text to display in the toast
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position: fixed',
    'bottom: 24px',
    'right: 24px',
    'background: #22c55e',
    'color: #ffffff',
    'padding: 12px 20px',
    'border-radius: 8px',
    'font-size: 14px',
    'font-weight: 500',
    'z-index: 9999',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
    'transition: opacity 0.3s ease'
  ].join(';');

  document.body.appendChild(toast);

  // Fade out then remove
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 2200);
}


// ── BOOT ─────────────────────────────────────────────────────

// Update the cart badge immediately when this script loads.
// This runs synchronously before any inline script on the page,
// so the badge is correct from the very first render.
updateCartBadge();