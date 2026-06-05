import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const origin = req.headers.origin || '';
  const allowed = ['https://summrtools.co.zw', 'https://www.summrtools.co.zw', 'http://localhost:3000'];
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);

  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Customer ID required' });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://summrtools.co.zw/dashboard.html'
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
