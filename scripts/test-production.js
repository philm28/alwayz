#!/usr/bin/env node

/**
 * Production Testing Script
 * Comprehensive testing suite for production deployment
 */

import fetch from 'node-fetch';
import { execSync } from 'child_process';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000';

class ProductionTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async test(name, testFn) {
    console.log(`🧪 Testing: ${name}`);
    
    try {
      await testFn();
      console.log(`✅ ${name}: PASSED`);
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      console.error(`❌ ${name}: FAILED - ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async testWebsiteAccessibility() {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`Website not accessible: ${response.status}`);
    }
    
    const html = await response.text();
    if (!html.includes('AlwayZ')) {
      throw new Error('Website content not loading correctly');
    }
  }

  async testHTTPSRedirect() {
    if (BASE_URL.startsWith('https://')) {
      const httpUrl = BASE_URL.replace('https://', 'http://');
      const response = await fetch(httpUrl, { redirect: 'manual' });
      
      if (response.status !== 301 && response.status !== 302) {
        throw new Error('HTTPS redirect not configured');
      }
    }
  }

  async testSecurityHeaders() {
    const response = await fetch(BASE_URL);
    const headers = response.headers;
    
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection'
    ];
    
    for (const header of requiredHeaders) {
      if (!headers.get(header)) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
  }

  async testPageLoadSpeed() {
    const start = Date.now();
    const response = await fetch(BASE_URL);
    const end = Date.now();
    
    const loadTime = end - start;
    if (loadTime > 3000) {
      throw new Error(`Page load time too slow: ${loadTime}ms`);
    }
  }

  async testAPIEndpoints() {
    // Test Supabase connection
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Supabase API not accessible');
      }
    }
  }

  async testPWAManifest() {
    const response = await fetch(`${BASE_URL}/manifest.json`);
    if (!response.ok) {
      throw new Error('PWA manifest not found');
    }
    
    const manifest = await response.json();
    if (!manifest.name || !manifest.icons) {
      throw new Error('PWA manifest incomplete');
    }
  }

  async testServiceWorker() {
    const response = await fetch(`${BASE_URL}/sw.js`);
    if (!response.ok) {
      throw new Error('Service worker not found');
    }
  }

  async testSEOMetaTags() {
    const response = await fetch(BASE_URL);
    const html = await response.text();
    
    const requiredTags = [
      '<title>',
      '<meta name="description"',
      '<meta property="og:title"',
      '<meta property="og:description"',
      '<meta name="twitter:card"'
    ];
    
    for (const tag of requiredTags) {
      if (!html.includes(tag)) {
        throw new Error(`Missing SEO tag: ${tag}`);
      }
    }
  }

  async testMobileResponsiveness() {
    const response = await fetch(BASE_URL);
    const html = await response.text();
    
    if (!html.includes('viewport')) {
      throw new Error('Viewport meta tag missing');
    }
    
    // Check for responsive CSS classes
    if (!html.includes('responsive') && !html.includes('md:') && !html.includes('sm:')) {
      throw new Error('Responsive design classes not found');
    }
  }

  async testErrorHandling() {
    // Test 404 page
    const response = await fetch(`${BASE_URL}/non-existent-page`);
    if (response.status !== 404 && response.status !== 200) {
      throw new Error('Error handling not configured properly');
    }
  }

  async runAllTests() {
    console.log('🚀 Starting production tests...\n');
    
    await this.test('Website Accessibility', () => this.testWebsiteAccessibility());
    await this.test('HTTPS Redirect', () => this.testHTTPSRedirect());
    await this.test('Security Headers', () => this.testSecurityHeaders());
    await this.test('Page Load Speed', () => this.testPageLoadSpeed());
    await this.test('API Endpoints', () => this.testAPIEndpoints());
    await this.test('PWA Manifest', () => this.testPWAManifest());
    await this.test('Service Worker', () => this.testServiceWorker());
    await this.test('SEO Meta Tags', () => this.testSEOMetaTags());
    await this.test('Mobile Responsiveness', () => this.testMobileResponsiveness());
    await this.test('Error Handling', () => this.testErrorHandling());
    
    this.printResults();
  }

  printResults() {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => console.log(`   - ${test.name}: ${test.error}`));
    }
    
    console.log('\n' + (this.results.failed === 0 ? '🎉 All tests passed! Ready for production.' : '⚠️  Some tests failed. Please fix before launching.'));
  }
}

// Run tests
const tester = new ProductionTester();
tester.runAllTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});