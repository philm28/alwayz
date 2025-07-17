#!/bin/bash

# AlwayZ Automated Deployment Script
# This script automates the entire deployment process

set -e  # Exit on any error

echo "🚀 Starting AlwayZ Deployment Process..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Verify Environment
print_status "Step 1: Verifying environment..."
if [ ! -f ".env" ]; then
    print_error "Environment file not found!"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Check for required environment variables
required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY" "VITE_STRIPE_PUBLISHABLE_KEY")
for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env; then
        print_error "Missing required environment variable: $var"
        exit 1
    fi
done

print_success "Environment verification complete!"

# Step 2: Install Dependencies
print_status "Step 2: Installing dependencies..."
npm install
print_success "Dependencies installed!"

# Step 3: Type Checking
print_status "Step 3: Running type checks..."
npm run type-check
print_success "Type checking passed!"

# Step 4: Linting
print_status "Step 4: Running linter..."
npm run lint
print_success "Linting passed!"

# Step 5: Build Application
print_status "Step 5: Building application for production..."
npm run build

# Verify build completed successfully
if [ ! -d "dist" ]; then
    print_error "Build failed! The dist directory was not created."
    exit 1
fi

print_success "Build completed!"

# Step 6: Analyze Build
print_status "Step 6: Analyzing build..."
if [ -d "dist" ]; then
    print_success "Build directory created successfully!"
    
    # List main files using ls (available in WebContainer)
    echo "Main build files:"
    if [ -d "dist/assets" ]; then
        ls -la dist/assets/ | head -10
    else
        ls -la dist/
    fi
    
    # Count files instead of using du (which isn't available)
    file_count=$(find dist -type f | wc -l)
    print_success "Build contains $file_count files"
else
    print_error "Build directory not found!"
    exit 1
fi

# Step 7: Test Build Locally
print_status "Step 7: Testing build locally..."
echo "Starting preview server on http://localhost:4173"
echo "Press Ctrl+C to stop the preview and continue with deployment"
npm run preview &
PREVIEW_PID=$!

# Wait for user input
echo ""
print_warning "Preview server started. Test your application at http://localhost:4173"
read -p "Press Enter when you're ready to continue with deployment..."

# Kill preview server
kill $PREVIEW_PID 2>/dev/null || true

# Step 8: Deployment Instructions
echo ""
echo "========================================"
print_success "Build completed successfully!"
echo "========================================"
echo ""
echo "🎯 Next Steps for Deployment:"
echo ""
echo "1. NETLIFY DEPLOYMENT (Drag & Drop Method):"
echo "   • Go to https://netlify.com"
echo "   • Drag and drop the 'dist' folder to deploy"
echo "   • Get your deployment URL"
echo ""
echo "2. ENVIRONMENT VARIABLES:"
echo "   • Add these to your Netlify site settings:"
echo "   • VITE_SUPABASE_URL"
echo "   • VITE_SUPABASE_ANON_KEY"
echo "   • VITE_STRIPE_PUBLISHABLE_KEY"
echo "   • VITE_GA_MEASUREMENT_ID"
echo "   • VITE_SENTRY_DSN"
echo "   • VITE_APP_URL (your Netlify URL)"
echo ""
echo "3. SUPABASE EDGE FUNCTIONS:"
echo "   • Deploy functions using Supabase CLI from your local machine"
echo "   • Configure environment variables in Supabase dashboard"
echo ""
echo "4. STRIPE WEBHOOKS:"
echo "   • Add webhook endpoint in Stripe dashboard"
echo "   • URL: https://[your-project].supabase.co/functions/v1/stripe-webhook"
echo ""
echo "📋 See DEPLOYMENT_STEPS.md for detailed instructions"
echo ""
print_success "Your application is ready for deployment! 🚀"