#!/usr/bin/env node

/**
 * Netlify Deployment Helper
 * Automates Netlify deployment process
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Netlify Deployment Helper\n');

// Check if build exists
const distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ Build directory not found!');
  console.log('Please run "npm run build" first.\n');
  process.exit(1);
}

// Get build info
const stats = fs.statSync(distPath);
const files = fs.readdirSync(distPath);
const assetFiles = fs.readdirSync(path.join(distPath, 'assets')).length;

console.log('📦 Build Information:');
console.log(`   • Build directory: ${distPath}`);
console.log(`   • Files: ${files.length} files`);
console.log(`   • Assets: ${assetFiles} asset files`);
console.log(`   • Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

// Environment variables to configure
const envVars = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'Your Supabase project URL',
    example: 'https://mzdldixwiedqdfvuuxxi.supabase.co'
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'Your Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  {
    name: 'VITE_STRIPE_PUBLISHABLE_KEY',
    description: 'Your Stripe publishable key',
    example: 'pk_test_...'
  },
  {
    name: 'VITE_GA_MEASUREMENT_ID',
    description: 'Google Analytics measurement ID',
    example: 'G-YEJS87M2X8'
  },
  {
    name: 'VITE_SENTRY_DSN',
    description: 'Sentry error monitoring DSN',
    example: 'https://...@sentry.io/...'
  },
  {
    name: 'VITE_APP_URL',
    description: 'Your deployed application URL',
    example: 'https://your-site.netlify.app'
  }
];

console.log('🔧 Deployment Steps:\n');

console.log('1. DEPLOY TO NETLIFY:');
console.log('   Option A - Drag & Drop (Quickest):');
console.log('   • Go to https://netlify.com');
console.log('   • Sign up or log in');
console.log('   • Drag the "dist" folder to the deploy area');
console.log('   • Wait for deployment to complete\n');

console.log('   Option B - Git Integration (Recommended):');
console.log('   • Push your code to GitHub');
console.log('   • Connect repository to Netlify');
console.log('   • Set build command: npm run build');
console.log('   • Set publish directory: dist\n');

console.log('2. CONFIGURE ENVIRONMENT VARIABLES:');
console.log('   After deployment, add these variables in Netlify:\n');

envVars.forEach(envVar => {
  console.log(`   ${envVar.name}`);
  console.log(`   └─ ${envVar.description}`);
  console.log(`   └─ Example: ${envVar.example}\n`);
});

console.log('3. REDEPLOY:');
console.log('   • After adding environment variables');
console.log('   • Click "Trigger deploy" in Netlify dashboard');
console.log('   • Wait for rebuild with new variables\n');

console.log('4. TEST DEPLOYMENT:');
console.log('   • Visit your Netlify URL');
console.log('   • Test user registration');
console.log('   • Test persona creation');
console.log('   • Check browser console for errors\n');

console.log('5. CUSTOM DOMAIN (Optional):');
console.log('   • Buy a domain from any registrar');
console.log('   • Add custom domain in Netlify settings');
console.log('   • Update DNS records as instructed');
console.log('   • SSL certificate is automatic\n');

console.log('📋 Quick Checklist:');
console.log('   □ Build completed successfully');
console.log('   □ Deployed to Netlify');
console.log('   □ Environment variables configured');
console.log('   □ Site loads without errors');
console.log('   □ User registration works');
console.log('   □ Database connection works\n');

console.log('🆘 Need Help?');
console.log('   • Netlify Docs: https://docs.netlify.com');
console.log('   • Deployment Guide: See DEPLOYMENT_STEPS.md');
console.log('   • Test Script: node post-deploy-test.js [YOUR_URL]\n');

console.log('✨ Your AlwayZ application is ready for deployment!');