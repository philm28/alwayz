import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initializeMonitoring() {
  // Only initialize in production
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        integrations: [
          new BrowserTracing(),
        ],
        tracesSampleRate: 0.1,
        environment: import.meta.env.MODE,
        beforeSend(event) {
          // Filter out non-critical errors
          if (event.exception) {
            const error = event.exception.values?.[0];
            // Filter out service worker errors in environments that don't support them
            if (error?.value && (
              error.value.includes('Service Workers are not yet supported') ||
              error.value.includes('Failed to register a ServiceWorker')
            )) {
              return null;
            }
            // Filter out other common non-critical errors
            if (error?.type === 'ChunkLoadError' || error?.type === 'NetworkError') {
              return null;
            }
          }
          return event;
        },
        // Enable session replay for debugging
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      });
      console.log('Monitoring initialized successfully');
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    }
  } else {
    console.log('Monitoring disabled in development or missing DSN');
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Error captured:', error, context);
  
  if (import.meta.env.PROD) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
      }
      Sentry.captureException(error);
    });
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console.log(`[${level.toUpperCase()}] ${message}`);
  
  if (import.meta.env.PROD) {
    Sentry.captureMessage(message, level);
  }
}

export function setUserContext(user: { id: string; email: string; subscription?: string }) {
  if (import.meta.env.PROD) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      subscription: user.subscription,
    });
  }
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (import.meta.env.PROD) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

// Performance monitoring helpers
export function startTransaction(name: string, operation: string) {
  if (import.meta.env.PROD) {
    return Sentry.startTransaction({ name, op: operation });
  }
  return null;
}

export function finishTransaction(transaction: any) {
  if (transaction && import.meta.env.PROD) {
    transaction.finish();
  }
}