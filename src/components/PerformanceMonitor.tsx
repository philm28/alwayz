import React, { useEffect } from 'react';
import { captureMessage } from '../lib/monitoring';

export function PerformanceMonitor() {
  useEffect(() => {
    // Only run in production or when Service Workers are supported
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
      console.log('Performance monitoring disabled in development or unsupported environment');
      return;
    }

    // Monitor Core Web Vitals only if available
    const monitorWebVitals = async () => {
      try {
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
        
        getCLS((metric) => {
          captureMessage(`CLS: ${metric.value}`, 'info');
        });
        
        getFID((metric) => {
          captureMessage(`FID: ${metric.value}`, 'info');
        });
        
        getFCP((metric) => {
          captureMessage(`FCP: ${metric.value}`, 'info');
        });
        
        getLCP((metric) => {
          captureMessage(`LCP: ${metric.value}`, 'info');
        });
        
        getTTFB((metric) => {
          captureMessage(`TTFB: ${metric.value}`, 'info');
        });
      } catch (error) {
        console.log('Web Vitals not available');
      }
    };

    monitorWebVitals();

    // Monitor memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = {
        used: Math.round(memory.usedJSHeapSize / 1048576),
        total: Math.round(memory.totalJSHeapSize / 1048576),
        limit: Math.round(memory.jsHeapSizeLimit / 1048576)
      };
      
      if (memoryUsage.used > memoryUsage.limit * 0.8) {
        captureMessage(`High memory usage: ${memoryUsage.used}MB`, 'warning');
      }
    }

    // Monitor network connection
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        captureMessage(`Slow connection detected: ${connection.effectiveType}`, 'info');
      }
    }

    // Monitor page load time
    const handleLoad = () => {
      setTimeout(() => {
        if ('performance' in window && 'timing' in performance) {
          const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
          if (loadTime > 3000) {
            captureMessage(`Slow page load: ${loadTime}ms`, 'warning');
          }
        }
      }, 0);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  return null;
}