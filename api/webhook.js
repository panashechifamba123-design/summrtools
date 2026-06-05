import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TIER_CREDITS = { starter: 20, pro: 60, elite: 99999 };

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: 'Webhook error: ' + err.message });
  }

  try {
    switch (event.type) {

      // Payment succeeded — upgrade tier
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        if (userId && tier) {
          await supabase.from('profiles').update({
            tier: tier,
            cv_credits: TIER_CREDITS[tier] || 3,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription
          }).eq('id', userId);
          console.log('Upgraded user', userId, 'to', tier);
        }
        break;
      }

      // Subscription renewed — top up credits
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId = sub.metadata?.userId;
          const tier = sub.metadata?.tier;
          if (userId && tier) {
            await supabase.from('profiles').update({
              cv_credits: TIER_CREDITS[tier] || 3
            }).eq('id', userId);
            console.log('Renewed credits for', userId, 'tier', tier);
          }
        }
        break;
      }

      // Subscription cancelled — downgrade to free
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabase.from('profiles').update({
            tier: 'free',
            cv_credits: 3,
            stripe_subscription_id: null
          }).eq('id', userId);
          console.log('Downgraded user', userId, 'to free');
        }
        break;
      }

      // Payment failed — notify but keep access for now
      case 'invoice.payment_failed': {
        console.warn('Payment failed for invoice:', event.data.object.id);
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Handler error' });
  }
}
