import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

let stripePromise: Promise<Stripe | null>;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    personas: number;
    conversations: number;
    storage: string;
    voiceMinutes: number;
  };
  stripePriceId: string;
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '1 AI Persona',
      '10 conversations/month',
      'Basic voice synthesis',
      '100MB storage',
      'Community support'
    ],
    limits: {
      personas: 1,
      conversations: 10,
      storage: '100MB',
      voiceMinutes: 30
    },
    stripePriceId: ''
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    interval: 'month',
    features: [
      '5 AI Personas',
      'Unlimited conversations',
      'Premium voice synthesis',
      '10GB storage',
      'Video calls',
      'Social media import',
      'Priority support'
    ],
    limits: {
      personas: 5,
      conversations: -1, // unlimited
      storage: '10GB',
      voiceMinutes: 500
    },
    stripePriceId: 'price_pro_monthly'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 99,
    interval: 'month',
    features: [
      'Unlimited AI Personas',
      'Unlimited conversations',
      'Custom voice cloning',
      '100GB storage',
      'Advanced video calls',
      'API access',
      'White-label options',
      'Dedicated support'
    ],
    limits: {
      personas: -1, // unlimited
      conversations: -1, // unlimited
      storage: '100GB',
      voiceMinutes: -1 // unlimited
    },
    stripePriceId: 'price_premium_monthly'
  }
];

export interface PaymentSession {
  sessionId: string;
  url: string;
}

export class PaymentManager {
  private stripe: Stripe | null = null;

  async initialize(): Promise<void> {
    this.stripe = await getStripe();
  }

  async createCheckoutSession(planId: string, userId: string): Promise<PaymentSession> {
    try {
      const plan = subscriptionPlans.find(p => p.id === planId);
      if (!plan || plan.price === 0) {
        throw new Error('Invalid plan selected');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: plan.stripePriceId,
          userId,
          planId
        }
      });

      if (error) throw error;

      return {
        sessionId: data.sessionId,
        url: data.url
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  async createPortalSession(customerId: string): Promise<{ url: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { customerId }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw new Error('Failed to create portal session');
    }
  }

  async getCurrentSubscription(userId: string): Promise<{
    plan: SubscriptionPlan;
    status: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !data) return null;

      const plan = subscriptionPlans.find(p => p.id === data.plan_name) || subscriptionPlans[0];

      return {
        plan,
        status: data.status,
        currentPeriodEnd: new Date(data.current_period_end),
        cancelAtPeriodEnd: data.cancel_at_period_end || false
      };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  }

  async getUsageStats(userId: string): Promise<{
    personas: number;
    conversations: number;
    storageUsed: number;
    voiceMinutesUsed: number;
  }> {
    try {
      // Get personas count
      const { count: personasCount } = await supabase
        .from('personas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get conversations count (current month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', startOfMonth.toISOString());

      // Get storage usage (sum of file sizes)
      const { data: contentData } = await supabase
        .from('persona_content')
        .select('file_size')
        .in('persona_id', 
          (await supabase.from('personas').select('id').eq('user_id', userId)).data?.map(p => p.id) || []
        );

      const storageUsed = contentData?.reduce((sum, item) => sum + (item.file_size || 0), 0) || 0;

      // Get voice minutes used (current month)
      const { data: conversationData } = await supabase
        .from('conversations')
        .select('duration_seconds')
        .eq('user_id', userId)
        .gte('started_at', startOfMonth.toISOString());

      const voiceMinutesUsed = Math.round(
        (conversationData?.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) || 0) / 60
      );

      return {
        personas: personasCount || 0,
        conversations: conversationsCount || 0,
        storageUsed: Math.round(storageUsed / (1024 * 1024)), // Convert to MB
        voiceMinutesUsed
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return {
        personas: 0,
        conversations: 0,
        storageUsed: 0,
        voiceMinutesUsed: 0
      };
    }
  }

  async checkUsageLimits(userId: string, action: 'create_persona' | 'start_conversation' | 'upload_file'): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      const usage = await this.getUsageStats(userId);
      const plan = subscription?.plan || subscriptionPlans[0]; // Default to free plan

      switch (action) {
        case 'create_persona':
          if (plan.limits.personas !== -1 && usage.personas >= plan.limits.personas) {
            return {
              allowed: false,
              reason: `You've reached your limit of ${plan.limits.personas} personas`,
              upgradeRequired: true
            };
          }
          break;

        case 'start_conversation':
          if (plan.limits.conversations !== -1 && usage.conversations >= plan.limits.conversations) {
            return {
              allowed: false,
              reason: `You've reached your monthly limit of ${plan.limits.conversations} conversations`,
              upgradeRequired: true
            };
          }
          break;

        case 'upload_file':
          // This would need file size to check properly
          break;
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return { allowed: true }; // Allow by default on error
    }
  }
}

export const paymentManager = new PaymentManager();