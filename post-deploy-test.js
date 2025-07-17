#!/usr/bin/env node

/**
 * Post-Deployment Testing Suite
 * Comprehensive testing after deployment
 */

const BASE_URL = process.env.DEPLOYMENT_URL || process.argv[2];

if (!BASE_URL) {
  console.log('❌ Please provide deployment URL:');
  console.log('   node post-deploy-test.js https://your-site.netlify.app');
  process.exit(1);
}

console.log(`🧪 Testing deployed application at: ${BASE_URL}\n`);

const tests = [
  {
    name: 'Website Accessibility',
    description: 'Check if the main page loads correctly',
    test: async () => {
      const response = await fetch(BASE_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      if (!html.includes('AlwayZ')) throw new Error('Content not loading');
      if (!html.includes('Keep Their Memory Alive')) throw new Error('Missing tagline');
      
      return 'Main page loads with correct content';
    }
  },
  {
    name: 'PWA Configuration',
    description: 'Verify Progressive Web App setup',
    test: async () => {
      const manifestResponse = await fetch(`${BASE_URL}/manifest.json`);
      if (!manifestResponse.ok) throw new Error('Manifest not found');
      
      const manifest = await manifestResponse.json();
      if (!manifest.name || !manifest.icons) throw new Error('Invalid manifest');
      
      const swResponse = await fetch(`${BASE_URL}/sw.js`);
      if (!swResponse.ok) throw new Error('Service worker not found');
      
      return 'PWA manifest and service worker configured';
    }
  },
  {
    name: 'Security Headers',
    description: 'Check security headers are present',
    test: async () => {
      const response = await fetch(BASE_URL);
      const headers = response.headers;
      
      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection'
      ];
      
      const missing = requiredHeaders.filter(header => !headers.get(header));
      if (missing.length > 0) {
        throw new Error(`Missing headers: ${missing.join(', ')}`);
      }
      
      return 'Security headers properly configured';
    }
  },
  {
    name: 'Asset Loading',
    description: 'Verify CSS and JS assets load correctly',
    test: async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      // Extract asset URLs
      const cssMatch = html.match(/href="([^"]*\.css)"/);
      const jsMatch = html.match(/src="([^"]*\.js)"/);
      
      if (!cssMatch || !jsMatch) throw new Error('Assets not found in HTML');
      
      const cssUrl = cssMatch[1].startsWith('http') ? cssMatch[1] : `${BASE_URL}${cssMatch[1]}`;
      const jsUrl = jsMatch[1].startsWith('http') ? jsMatch[1] : `${BASE_URL}${jsMatch[1]}`;
      
      const [cssResponse, jsResponse] = await Promise.all([
        fetch(cssUrl),
        fetch(jsUrl)
      ]);
      
      if (!cssResponse.ok) throw new Error('CSS asset failed to load');
      if (!jsResponse.ok) throw new Error('JS asset failed to load');
      
      return 'CSS and JavaScript assets loading correctly';
    }
  },
  {
    name: 'Performance Check',
    description: 'Basic performance metrics',
    test: async () => {
      const start = Date.now();
      const response = await fetch(BASE_URL);
      const end = Date.now();
      
      const loadTime = end - start;
      const contentLength = response.headers.get('content-length');
      
      if (loadTime > 5000) {
        throw new Error(`Slow load time: ${loadTime}ms`);
      }
      
      return `Load time: ${loadTime}ms, Size: ${contentLength ? Math.round(contentLength/1024) + 'KB' : 'unknown'}`;
    }
  },
  {
    name: 'Error Pages',
    description: 'Check 404 handling',
    test: async () => {
      const response = await fetch(`${BASE_URL}/non-existent-page`);
      
      // Should either return 404 or redirect to main page (SPA behavior)
      if (response.status !== 404 && response.status !== 200) {
        throw new Error(`Unexpected status: ${response.status}`);
      }
      
      return 'Error pages handled correctly';
    }
  },
  {
    name: 'Mobile Responsiveness',
    description: 'Check viewport and responsive design',
    test: async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      if (!html.includes('viewport')) {
        throw new Error('Viewport meta tag missing');
      }
      
      // Check for responsive CSS classes (Tailwind)
      if (!html.includes('md:') && !html.includes('sm:') && !html.includes('lg:')) {
        throw new Error('Responsive design classes not found');
      }
      
      return 'Mobile-responsive design detected';
    }
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  console.log('Running comprehensive deployment tests...\n');

  for (const test of tests) {
    process.stdout.write(`🔍 ${test.name}... `);
    
    try {
      const result = await test.test();
      console.log(`✅ ${result}`);
      passed++;
      results.push({ name: test.name, status: 'PASSED', result });
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failed++;
      results.push({ name: test.name, status: 'FAILED', error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => r.status === 'FAILED')
      .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
  }

  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Your deployment is successful!');
    console.log('\n🚀 Your AlwayZ application is live and ready!');
    console.log(`🌐 Visit: ${BASE_URL}`);
  } else {
    console.log('⚠️  Some tests failed. Please review and fix the issues above.');
    console.log('💡 Most issues can be resolved by checking:');
    console.log('   • Environment variables in Netlify');
    console.log('   • Build configuration');
    console.log('   • DNS/domain settings');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('   • Set up Supabase edge functions');
  console.log('   • Configure Stripe webhooks');
  console.log('   • Test user registration and core features');
  console.log('   • Monitor analytics and error tracking');
}

// Add fetch polyfill for Node.js if needed
if (typeof fetch === 'undefined') {
  import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
    runTests().catch(console.error);
  });
} else {
  runTests().catch(console.error);
}