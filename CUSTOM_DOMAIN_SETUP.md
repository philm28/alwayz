# Setting Up a Custom Domain for AlwayZ

This guide will help you set up a custom domain for your AlwayZ application deployed on Netlify.

## Step 1: Purchase a Domain

If you don't already have a domain:

1. Choose a domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
2. Search for your preferred domain name (e.g., yourdomain.com)
3. Complete the purchase process

## Step 2: Add Your Domain to Netlify

1. Go to your Netlify dashboard
2. Select your AlwayZ site
3. Go to **Site settings** → **Domain management**
4. Click **Add custom domain**
5. Enter your domain name and click **Verify**
6. Choose whether to add www subdomain as well

## Step 3: Configure DNS

### Option A: Use Netlify DNS (Recommended)

1. In the domain settings, click **Set up Netlify DNS**
2. Follow the instructions to add the Netlify nameservers to your domain registrar
3. This typically involves:
   - Logging into your domain registrar
   - Finding DNS or nameserver settings
   - Replacing the current nameservers with Netlify's nameservers
   - Waiting for DNS propagation (can take up to 48 hours)

### Option B: Use External DNS

If you prefer to keep your existing DNS provider:

1. Go to your DNS provider's dashboard
2. Add a CNAME record:
   - Name/Host: `www` (or @ for root domain)
   - Value/Target: Your Netlify URL (e.g., `your-site-name.netlify.app`)
   - TTL: Auto or 3600
3. For root domains, you may need to add an A record:
   - Name/Host: `@`
   - Value/Target: Netlify's load balancer IP (provided in Netlify's instructions)
   - TTL: Auto or 3600

## Step 4: Set Up SSL

Netlify automatically provisions SSL certificates for your custom domain:

1. In your site's domain settings, look for **HTTPS**
2. Netlify should show "SSL/TLS certificate is active"
3. If there are issues, click **Renew certificate**

## Step 5: Update Environment Variables

After setting up your custom domain:

1. Go to your site's environment variables
2. Update `VITE_APP_URL` to your custom domain (e.g., `https://yourdomain.com`)
3. Trigger a new deploy

## Step 6: Verify Setup

1. Visit your custom domain
2. Check that HTTPS is working (look for the lock icon in the browser)
3. Verify all functionality works correctly
4. Test on both www and non-www versions of your domain

## Step 7: Additional Optimizations

### Set Up Redirects

Create a `_redirects` file in your project's public directory:

```
# Redirect default Netlify subdomain to primary domain
https://your-site-name.netlify.app/* https://yourdomain.com/:splat 301!
```

### Update Sitemap and Robots.txt

Update your sitemap.xml and robots.txt files to use your custom domain.

## Troubleshooting

### Domain Not Connecting
- Verify nameserver changes at your registrar
- Check DNS propagation using [whatsmydns.net](https://www.whatsmydns.net/)
- Ensure CNAME/A records are correctly configured

### SSL Certificate Issues
- Make sure DNS is fully propagated before requesting certificates
- Check for CAA records that might block certificate issuance
- Contact Netlify support if certificates don't provision automatically

### Mixed Content Warnings
- Update any hardcoded URLs in your code to use HTTPS
- Check for resources loaded from HTTP instead of HTTPS

For more information, see [Netlify's custom domain documentation](https://docs.netlify.com/domains-https/custom-domains/).