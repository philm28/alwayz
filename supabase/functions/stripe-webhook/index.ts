import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    // Verify webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    
    // In production, verify the webhook signature here
    // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    
    // For demo, parse the body directly
    const event = JSON.parse(body)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(supabase, event.data.object)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(supabase, event.data.object)
        break
        
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(supabase, event.data.object)
        break
        
      case 'invoice.payment_failed':
        await handlePaymentFailure(supabase, event.data.object)
        break
        
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handleSubscriptionUpdate(supabase: any, subscription: any) {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      status: subscription.status,
      plan_name: getPlanNameFromPriceId(subscription.items.data[0].price.id),
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating subscription:', error)
  }

  // Update user's subscription tier in profiles
  await supabase
    .from('profiles')
    .update({ 
      subscription_tier: getPlanNameFromPriceId(subscription.items.data[0].price.id),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)
}

async function handleSubscriptionCancellation(supabase: any, subscription: any) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error canceling subscription:', error)
  }

  // Downgrade user to free tier
  await supabase
    .from('profiles')
    .update({ 
      subscription_tier: 'free',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)
}

async function handlePaymentSuccess(supabase: any, invoice: any) {
  console.log('Payment succeeded for customer:', invoice.customer)
  
  // Update subscription status if needed
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)
  }
}

async function handlePaymentFailure(supabase: any, invoice: any) {
  console.log('Payment failed for customer:', invoice.customer)
  
  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)
  }
}

function getPlanNameFromPriceId(priceId: string): string {
  const priceMap: { [key: string]: string } = {
    'price_pro_monthly': 'pro',
    'price_premium_monthly': 'premium',
    'price_pro_yearly': 'pro',
    'price_premium_yearly': 'premium'
  }
  
  return priceMap[priceId] || 'free'
}