#!/usr/bin/env node

/**
 * Quick Deployment Verification
 * Checks if everything is ready for deployment
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying deployment readiness...\n');

// Check environment variables
const envFile = '.env';
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_GA_MEASUREMENT_ID',
  'VITE_SENTRY_DSN'
];

let envContent = '';
try {
  envContent = fs.readFileSync(envFile, 'utf8');
  console.log('✅ Environment file found');
} catch (error) {
  console.log('❌ Environment file not found');
  process.exit(1);
}

// Check required environment variables
let missingVars = [];
requiredEnvVars.forEach(varName => {
  if (!envContent.includes(varName + '=') || envContent.includes(varName + '=your_')) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log('❌ Missing or incomplete environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\nPlease configure these before deploying.\n');
} else {
  console.log('✅ All required environment variables configured\n');
}

// Check if build directory exists
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log('✅ Build directory exists');
  
  // Check build size
  const stats = fs.statSync(distPath);
  console.log(`📦 Build directory size: ${(stats.size / 1024).toFixed(2)} KB`);
} else {
  console.log('⚠️  Build directory not found. Run "npm run build" first.');
}

// Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['build', 'preview', 'type-check'];
const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);

if (missingScripts.length === 0) {
  console.log('✅ All required npm scripts present');
} else {
  console.log('❌ Missing npm scripts:', missingScripts.join(', '));
}

// Summary
console.log('\n📋 Deployment Readiness Summary:');
console.log(`Environment Variables: ${missingVars.length === 0 ? '✅ Ready' : '❌ Needs attention'}`);
console.log(`Build System: ${missingScripts.length === 0 ? '✅ Ready' : '❌ Needs attention'}`);
console.log(`Build Output: ${fs.existsSync(distPath) ? '✅ Ready' : '⚠️  Run build first'}`);

if (missingVars.length === 0 && missingScripts.length === 0) {
  console.log('\n🎉 Your application is ready for deployment!');
  console.log('\nNext steps:');
  console.log('1. Run "npm run build" if you haven\'t already');
  console.log('2. Deploy to Netlify (drag & drop or Git integration)');
  console.log('3. Configure your custom domain');
  console.log('4. Set up Supabase edge functions');
  console.log('5. Test your deployed application');
} else {
  console.log('\n⚠️  Please address the issues above before deploying.');
}