// diamonds.js
// Handles dynamic diamond shop rendering and fetches live prices from backend

// Example diamond packages (amount is diamonds, price is fallback if backend fails)
const DIAMOND_PACKAGES = [
  { amount: 10, fallbackPrice: 1.99 },
  { amount: 50, fallbackPrice: 7.99 },
  { amount: 100, fallbackPrice: 15.99 },
  { amount: 200, fallbackPrice: 24.99 }
];

// Fetch live prices from backend
async function fetchDiamondPrices() {
  try {
    const res = await fetch('http://localhost:5500/diamond-prices');
    if (!res.ok) throw new Error('Failed to fetch prices');
    const data = await res.json();
    // data: [{ amount: 10, price: 1.99 }, ...]
    return data;
  } catch (e) {
    // fallback to static prices
    return DIAMOND_PACKAGES.map(pkg => ({ amount: pkg.amount, price: pkg.fallbackPrice }));
  }
}

// Start Stripe payment for selected package
async function buyDiamonds(amount, price) {
  const username = localStorage.getItem('loggedInUser') || 'guest';
  const res = await fetch('http://localhost:5500/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, username })
  });
  const data = await res.json();
  if (data.url) {
    window.location = data.url;
  } else {
    alert('Error creating payment session.');
  }
}
// Render diamond cards dynamically
async function renderDiamondShop() {
  const container = document.querySelector('.diamond-shop-cards');
  if (!container) return;
  container.innerHTML = '';
  const prices = await fetchDiamondPrices();
  prices.forEach(pkg => {
    const card = document.createElement('div');
    card.className = 'diamond-card';
    card.onclick = () => buyDiamonds(pkg.amount, pkg.price);
    card.innerHTML = `
      <div class="shine"></div>
      <div class="diamond-glow">
        <svg viewBox="0 0 64 64" fill="none">
          ${pkg.amount === 10 ? `
            <polygon points="32,6 58,24 48,58 16,58 6,24" fill="#4fd1ff" stroke="#ffd700" stroke-width="2.5"/>
            <polygon points="32,6 32,58 48,58 58,24" fill="#b6e6ff" opacity="0.7"/>
            <polygon points="32,6 32,58 16,58 6,24" fill="#ffb6e6" opacity="0.5"/>
          ` : `
            <rect x="12" y="32" width="40" height="20" rx="6" fill="#ffd6e0" stroke="#ffd700" stroke-width="2.5"/>
            <rect x="16" y="36" width="32" height="12" rx="3" fill="#fff" stroke="#ffb6e6" stroke-width="1.5"/>
            <rect x="12" y="24" width="40" height="12" rx="6" fill="#ffb6e6" stroke="#ffd700" stroke-width="2.5"/>
            <polygon points="32,30 38,36 26,36" fill="#4fd1ff" stroke="#ffd700" stroke-width="1.5"/>
            <polygon points="26,32 29,36 23,36" fill="#b6e6ff" stroke="#ffd700" stroke-width="1"/>
            <polygon points="38,32 41,36 35,36" fill="#b6e6ff" stroke="#ffd700" stroke-width="1"/>
          `}
        </svg>
        <span class="diamond-sparkle">✦</span>
      </div>
      <div class="diamond-card-amount">${pkg.amount} Diamonds</div>
      <div class="diamond-card-price">$${pkg.price.toFixed(2)}</div>
      <button class="buy-btn">Buy Now</button>
    `;
    // Add premium badge for 200 diamonds
    if (pkg.amount === 200) {
      const badge = document.createElement('div');
      badge.className = 'premium-badge';
      badge.textContent = 'Best Value';
      card.appendChild(badge);
    }
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', renderDiamondShop);

// On success.html, update local diamond balance after payment
if (window.location.pathname.endsWith('success.html')) {
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  const amount = parseInt(getQueryParam('amount'), 10);
  const username = getQueryParam('username');
  if (amount && username) {
    if (typeof addDiamonds === 'function') addDiamonds(username, amount);
    // Optionally, fetch server-side balance and sync
    // fetch(`http://localhost:5500/user-balance?username=${encodeURIComponent(username)}`)
    //   .then(r => r.json()).then(data => setDiamonds(username, data.diamonds));
  }
}