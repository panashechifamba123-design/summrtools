import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  starter: 'price_1Tf6pM0Jz1Y9fabbEeMajRDe',
  pro: 'price_1Tf6pj0Jz1Y9fabbKodOSBgm',
  elite: 'price_1Tf6qM0Jz1Y9fabbqq03RDRx'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const origin = req.headers.origin || '';
  const allowed = ['https://summrtools.co.zw', 'https://www.summrtools.co.zw', 'http://localhost:3000'];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  const { tier, userId, userEmail } = req.body;

  if (!tier || !PRICE_IDS[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  if (!userId || !userEmail) {
    return res.status(400).json({ error: 'User details required' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: 'https://summrtools.co.zw/dashboard.html?upgraded=true',
      cancel_url: 'https://summrtools.co.zw/dashboard.html?cancelled=true',
      metadata: { userId, tier },
      subscription_data: { metadata: { userId, tier } }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
