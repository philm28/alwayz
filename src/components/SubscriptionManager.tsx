import React, { useState, useEffect } from 'react';
import { Crown, Check, Zap, Users, Clock, HardDrive, Mic, CreditCard, ExternalLink } from 'lucide-react';
import { paymentManager, subscriptionPlans, SubscriptionPlan } from '../lib/payments';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export function SubscriptionManager() {
  const { user } = useAuth();
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSubscriptionData();
    }
  }, [user]);

  const loadSubscriptionData = async () => {
    try {
      await paymentManager.initialize();
      const [subscription, usageStats] = await Promise.all([
        paymentManager.getCurrentSubscription(user!.id),
        paymentManager.getUsageStats(user!.id)
      ]);
      
      setCurrentSubscription(subscription);
      setUsage(usageStats);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      toast.error('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!user) return;

    setUpgrading(planId);
    try {
      const session = await paymentManager.createCheckoutSession(planId, user.id);
      window.location.href = session.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start upgrade process');
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!currentSubscription?.customerId) return;

    try {
      const session = await paymentManager.createPortalSession(currentSubscription.customerId);
      window.open(session.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open subscription management');
    }
  };

  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const formatStorage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} MB`;
    return `${(bytes / 1024).toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription & Usage</h1>
        <p className="text-gray-600">Manage your AlwayZ subscription and monitor your usage</p>
      </div>

      {/* Current Usage */}
      {usage && currentSubscription && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Usage</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{usage.personas}</div>
              <div className="text-sm text-gray-500">
                of {currentSubscription.plan.limits.personas === -1 ? '∞' : currentSubscription.plan.limits.personas} personas
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${getUsagePercentage(usage.personas, currentSubscription.plan.limits.personas)}%` }}
                ></div>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{usage.conversations}</div>
              <div className="text-sm text-gray-500">
                of {currentSubscription.plan.limits.conversations === -1 ? '∞' : currentSubscription.plan.limits.conversations} conversations
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${getUsagePercentage(usage.conversations, currentSubscription.plan.limits.conversations)}%` }}
                ></div>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <HardDrive className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatStorage(usage.storageUsed)}</div>
              <div className="text-sm text-gray-500">of {currentSubscription.plan.limits.storage}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mic className="h-8 w-8 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{usage.voiceMinutesUsed}</div>
              <div className="text-sm text-gray-500">
                of {currentSubscription.plan.limits.voiceMinutes === -1 ? '∞' : currentSubscription.plan.limits.voiceMinutes} minutes
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${getUsagePercentage(usage.voiceMinutesUsed, currentSubscription.plan.limits.voiceMinutes)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plans */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Choose Your Plan</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => {
            const isCurrentPlan = currentSubscription?.plan?.id === plan.id;
            const isPopular = plan.id === 'pro';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 ${
                  isCurrentPlan
                    ? 'border-purple-500 ring-2 ring-purple-200'
                    : isPopular
                    ? 'border-purple-300'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      plan.id === 'free' ? 'bg-gray-100' :
                      plan.id === 'pro' ? 'bg-purple-100' : 'bg-gradient-to-br from-purple-100 to-blue-100'
                    }`}>
                      {plan.id === 'premium' ? (
                        <Crown className={`h-8 w-8 ${plan.id === 'premium' ? 'text-purple-600' : 'text-gray-600'}`} />
                      ) : (
                        <Zap className={`h-8 w-8 ${plan.id === 'pro' ? 'text-purple-600' : 'text-gray-600'}`} />
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      {plan.price > 0 && <span className="text-gray-500">/{plan.interval}</span>}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3">
                    {isCurrentPlan ? (
                      <button
                        onClick={handleManageSubscription}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id || plan.price === 0}
                        className={`w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300 ${
                          plan.id === 'pro' || plan.id === 'premium'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg'
                            : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        } disabled:opacity-50`}
                      >
                        {upgrading === plan.id ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </div>
                        ) : plan.price === 0 ? (
                          'Current Plan'
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Information */}
      {currentSubscription && currentSubscription.plan.price > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Current Plan</h3>
              <p className="text-gray-600">{currentSubscription.plan.name} - ${currentSubscription.plan.price}/{currentSubscription.plan.interval}</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Next Billing Date</h3>
              <p className="text-gray-600">{currentSubscription.currentPeriodEnd.toLocaleDateString()}</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleManageSubscription}
              className="flex items-center text-purple-600 hover:text-purple-700 font-medium"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage billing and payment methods
            </button>
          </div>
        </div>
      )}
    </div>
  );
}