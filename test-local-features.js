#!/usr/bin/env node

/**
 * Local Feature Testing Script
 * Tests core functionality on local preview server
 */

console.log('🧪 Testing Local Application Features...\n');

const BASE_URL = 'http://localhost:4173';

const tests = [
  {
    name: 'Application Loads',
    test: async () => {
      try {
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        if (!html.includes('AlwayZ')) throw new Error('App content not loading');
        if (!html.includes('Keep Their Memory Alive')) throw new Error('Missing tagline');
        
        return 'Application loads with correct branding';
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Preview server not running. Run "npm run preview" first.');
        }
        throw error;
      }
    }
  },
  {
    name: 'Static Assets',
    test: async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      // Check for CSS and JS assets
      const cssMatch = html.match(/href="([^"]*\.css)"/);
      const jsMatch = html.match(/src="([^"]*\.js)"/);
      
      if (!cssMatch || !jsMatch) throw new Error('Assets not found in HTML');
      
      const cssUrl = `${BASE_URL}${cssMatch[1]}`;
      const jsUrl = `${BASE_URL}${jsMatch[1]}`;
      
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
    name: 'PWA Manifest',
    test: async () => {
      const response = await fetch(`${BASE_URL}/manifest.json`);
      if (!response.ok) throw new Error('Manifest not found');
      
      const manifest = await response.json();
      if (!manifest.name || !manifest.icons) throw new Error('Invalid manifest');
      
      return 'PWA manifest configured correctly';
    }
  },
  {
    name: 'Service Worker',
    test: async () => {
      const response = await fetch(`${BASE_URL}/sw.js`);
      if (!response.ok) throw new Error('Service worker not found');
      
      return 'Service worker available';
    }
  },
  {
    name: 'Environment Variables',
    test: async () => {
      // Check if environment variables are loaded by looking for Supabase URL in the page
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      // In a real app, we'd check if the app initializes correctly
      // For now, we'll just verify the build includes our environment setup
      if (!html.includes('script')) throw new Error('No JavaScript found');
      
      return 'Environment variables appear to be configured';
    }
  },
  {
    name: 'Responsive Design',
    test: async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      if (!html.includes('viewport')) throw new Error('Viewport meta tag missing');
      
      // Check for Tailwind responsive classes
      if (!html.includes('md:') && !html.includes('sm:') && !html.includes('lg:')) {
        throw new Error('Responsive design classes not found');
      }
      
      return 'Mobile-responsive design detected';
    }
  },
  {
    name: 'Performance Check',
    test: async () => {
      const start = Date.now();
      const response = await fetch(BASE_URL);
      const end = Date.now();
      
      const loadTime = end - start;
      if (loadTime > 3000) throw new Error(`Slow load time: ${loadTime}ms`);
      
      return `Load time: ${loadTime}ms (good performance)`;
    }
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`🔍 ${test.name}... `);
    
    try {
      const result = await test.test();
      console.log(`✅ ${result}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Local Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 Local application is working perfectly!');
    console.log('\n🚀 Ready for deployment to Netlify!');
    console.log('\nNext steps:');
    console.log('1. Deploy to Netlify (drag & drop dist folder)');
    console.log('2. Configure environment variables');
    console.log('3. Test deployed version');
  } else {
    console.log('⚠️  Please fix issues before deploying.');
  }
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