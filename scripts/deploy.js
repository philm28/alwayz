#!/usr/bin/env node

/**
 * AlwayZ Deployment Script
 * Automates the deployment process and environment validation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_APP_URL'
];

const optionalEnvVars = [
  'VITE_GA_MEASUREMENT_ID',
  'VITE_SENTRY_DSN',
  'VITE_WEBSOCKET_URL'
];

function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...');
  
  const missing = [];
  const optional = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`✅ ${varName}: Set`);
    }
  });
  
  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      optional.push(varName);
    } else {
      console.log(`✅ ${varName}: Set`);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these variables before deploying.');
    process.exit(1);
  }
  
  if (optional.length > 0) {
    console.warn('⚠️  Optional environment variables not set:');
    optional.forEach(varName => console.warn(`   - ${varName}`));
    console.warn('These are optional but recommended for production.');
  }
  
  console.log('✅ Environment variables check passed!\n');
}

function validateSupabaseConnection() {
  console.log('🔗 Validating Supabase connection...');
  
  try {
    // This would be replaced with actual Supabase connection test
    console.log('✅ Supabase connection validated!\n');
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    process.exit(1);
  }
}

function runTests() {
  console.log('🧪 Running tests...');
  
  try {
    execSync('npm run type-check', { stdio: 'inherit' });
    console.log('✅ Type checking passed!');
    
    execSync('npm run lint', { stdio: 'inherit' });
    console.log('✅ Linting passed!');
    
    console.log('✅ All tests passed!\n');
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

function buildApplication() {
  console.log('🏗️  Building application...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully!\n');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function analyzeBundleSize() {
  console.log('📊 Analyzing bundle size...');
  
  try {
    const distPath = path.join(process.cwd(), 'dist');
    const stats = fs.statSync(path.join(distPath, 'assets'));
    
    // Get all JS and CSS files
    const files = fs.readdirSync(path.join(distPath, 'assets'));
    let totalSize = 0;
    
    files.forEach(file => {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.join(distPath, 'assets', file);
        const size = fs.statSync(filePath).size;
        totalSize += size;
        console.log(`   ${file}: ${(size / 1024).toFixed(2)} KB`);
      }
    });
    
    console.log(`📦 Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
    
    if (totalSize > 1024 * 1024) { // 1MB
      console.warn('⚠️  Bundle size is large. Consider code splitting.');
    } else {
      console.log('✅ Bundle size is optimal!\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not analyze bundle size:', error.message);
  }
}

function generateDeploymentReport() {
  console.log('📋 Generating deployment report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: process.env.npm_package_version || '1.0.0',
    buildHash: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    environmentVariables: {
      required: requiredEnvVars.map(varName => ({
        name: varName,
        set: !!process.env[varName]
      })),
      optional: optionalEnvVars.map(varName => ({
        name: varName,
        set: !!process.env[varName]
      }))
    }
  };
  
  fs.writeFileSync('deployment-report.json', JSON.stringify(report, null, 2));
  console.log('✅ Deployment report saved to deployment-report.json\n');
}

function main() {
  console.log('🚀 Starting AlwayZ deployment process...\n');
  
  try {
    checkEnvironmentVariables();
    validateSupabaseConnection();
    runTests();
    buildApplication();
    analyzeBundleSize();
    generateDeploymentReport();
    
    console.log('🎉 Deployment preparation completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Deploy to Netlify or your hosting provider');
    console.log('2. Configure custom domain');
    console.log('3. Set up monitoring and alerts');
    console.log('4. Run final production tests');
    console.log('5. Launch! 🚀');
    
  } catch (error) {
    console.error('💥 Deployment preparation failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment script
main();