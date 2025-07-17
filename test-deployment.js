#!/usr/bin/env node

/**
 * Quick Deployment Test
 * Run this after deployment to verify everything works
 */

const BASE_URL = process.env.DEPLOYMENT_URL || 'https://your-deployed-site.netlify.app';

async function testDeployment() {
  console.log('🧪 Testing deployment at:', BASE_URL);
  
  const tests = [
    {
      name: 'Website loads',
      test: async () => {
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const html = await response.text();
        if (!html.includes('AlwayZ')) throw new Error('Content not loading');
        return 'Website accessible and content loading';
      }
    },
    {
      name: 'PWA manifest',
      test: async () => {
        const response = await fetch(`${BASE_URL}/manifest.json`);
        if (!response.ok) throw new Error('Manifest not found');
        const manifest = await response.json();
        if (!manifest.name) throw new Error('Invalid manifest');
        return 'PWA manifest configured correctly';
      }
    },
    {
      name: 'Service worker',
      test: async () => {
        const response = await fetch(`${BASE_URL}/sw.js`);
        if (!response.ok) throw new Error('Service worker not found');
        return 'Service worker available';
      }
    },
    {
      name: 'Security headers',
      test: async () => {
        const response = await fetch(BASE_URL);
        const headers = response.headers;
        if (!headers.get('x-frame-options')) throw new Error('Missing X-Frame-Options');
        return 'Security headers configured';
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`✅ ${test.name}: ${result}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Your deployment is ready.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testDeployment().catch(console.error);