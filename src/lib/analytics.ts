import ReactGA from 'react-ga4';

export function initializeAnalytics() {
  if (import.meta.env.PROD && import.meta.env.VITE_GA_MEASUREMENT_ID) {
    ReactGA.initialize(import.meta.env.VITE_GA_MEASUREMENT_ID, {
      testMode: import.meta.env.DEV,
    });
  }
}

export function trackPageView(path: string, title?: string) {
  if (import.meta.env.PROD) {
    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: title || document.title,
    });
  }
}

export function trackEvent(action: string, category: string, label?: string, value?: number) {
  console.log(`Analytics Event: ${category} - ${action}`, { label, value });
  
  if (import.meta.env.PROD) {
    ReactGA.event({
      action,
      category,
      label,
      value,
    });
  }
}

export function trackUserSignup(method: string) {
  trackEvent('sign_up', 'auth', method);
}

export function trackPersonaCreated(personaType: string) {
  trackEvent('persona_created', 'personas', personaType);
}

export function trackConversationStarted(type: 'chat' | 'video' | 'voice') {
  trackEvent('conversation_started', 'conversations', type);
}

export function trackSubscriptionUpgrade(plan: string) {
  trackEvent('subscription_upgrade', 'payments', plan);
}

export function trackFeatureUsed(feature: string) {
  trackEvent('feature_used', 'engagement', feature);
}

export function trackError(error: string, context?: string) {
  trackEvent('error_occurred', 'errors', error, context ? 1 : 0);
}

export function setUserProperties(properties: Record<string, any>) {
  if (import.meta.env.PROD) {
    ReactGA.set(properties);
  }
}