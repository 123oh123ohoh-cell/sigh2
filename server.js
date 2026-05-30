// server.js
// Backend for Stripe diamond purchases
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

// Replace with your Stripe secret key (test key for development)
const stripe = Stripe('sk_test_XXXXXXXXXXXXXXXXXXXXXXXX');

const app = express();
app.use(cors());
app.use(express.json());


// Map diamond packages to Stripe price IDs and live prices
const DIAMOND_PACKAGES = [
  { amount: 10, priceId: 'price_10DIAMONDS', price: 1.99 },
  { amount: 50, priceId: 'price_1TcdvDHPwbB3PbUPfPs2T4Kl', price: 7.99 },
  { amount: 100, priceId: 'price_100DIAMONDS', price: 15.99 },
  { amount: 200, priceId: 'price_200DIAMONDS', price: 24.99 },
];

// Helper: get package by amount
function getPackage(amount) {
  return DIAMOND_PACKAGES.find(pkg => pkg.amount === Number(amount));
}


// Create Stripe Checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { amount, username } = req.body;
  const pkg = getPackage(amount);
  if (!pkg) return res.status(400).json({ error: 'Invalid diamond package.' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: pkg.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:5500/success.html?session_id={CHECKOUT_SESSION_ID}&amount=' + pkg.amount + '&username=' + encodeURIComponent(username),
      cancel_url: 'http://localhost:5500/diamonds.html',
      metadata: { username, amount: pkg.amount },
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for frontend to get live diamond prices
app.get('/diamond-prices', (req, res) => {
  res.json(DIAMOND_PACKAGES.map(pkg => ({ amount: pkg.amount, price: pkg.price })));
});

// Webhook endpoint to securely add diamonds after payment
const endpointSecret = 'whsec_XXXXXXXXXXXXXXXXXXXXXXXX'; // Set your Stripe webhook secret
const fs = require('fs');
const USER_DB = 'userProfiles.json';

// Helper: load/save user profiles (server-side, not localStorage)
function loadUserProfiles() {
  try {
    return JSON.parse(fs.readFileSync(USER_DB, 'utf8'));
  } catch {
    return {};
  }
}
function saveUserProfiles(profiles) {
  fs.writeFileSync(USER_DB, JSON.stringify(profiles, null, 2));
}
function addDiamondsServer(username, amount) {
  const profiles = loadUserProfiles();
  if (!profiles[username]) profiles[username] = { username, diamonds: 0 };
  profiles[username].diamonds = (profiles[username].diamonds || 0) + Number(amount);
  saveUserProfiles(profiles);
}

app.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }
  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const username = session.metadata.username;
    const amount = session.metadata.amount;
    addDiamondsServer(username, amount);
  }
  response.json({ received: true });
});

// (Optional) Serve static files for local testing
app.use(express.static('.'));

app.listen(5500, () => {
  console.log('Stripe backend running on http://localhost:5500');
});
