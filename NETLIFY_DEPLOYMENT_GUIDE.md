# Netlify Deployment Guide for AlwayZ

## The Problem: Missing index.html at Root Level

Netlify requires an `index.html` file at the root level of your uploaded folder. When you see the error message "Please drop a folder containing an index.html file", it means Netlify can't find this file at the root.

## Solution: Upload the Entire `dist` Folder

The correct way to deploy is to upload the **entire `dist` folder** - not just its contents.

## Step-by-Step Instructions

### Method 1: Zip and Upload (Recommended)

1. **Download the zip file** that was created:
   ```
   alwayz-deployment.zip
   ```

2. **Extract the zip file** on your local computer

3. **Upload to Netlify**:
   - Go to [netlify.com](https://netlify.com) and log in
   - Drag and drop the **entire extracted folder** (which should be named `dist`) to the upload area
   - Make sure you're uploading the folder itself, not just selecting the files inside it

### Method 2: Manual Upload

If you prefer to manually upload:

1. **Create a new empty folder** on your computer named "netlify-deploy"

2. **Copy these files** into the root of that folder:
   - index.html
   - manifest.webmanifest
   - registerSW.js
   - sw.js
   - robots.txt
   - sitemap.xml
   - Any PNG files (icon-192x192.png, icon-512x512.png, etc.)

3. **Create an `assets` subfolder** and copy all files from the assets directory into it

4. **Upload to Netlify**:
   - Drag and drop the entire "netlify-deploy" folder to Netlify

## Verifying Your Folder Structure

Before uploading, your folder structure should look like this:

```
dist/
├── index.html           <-- This must be at the root level
├── manifest.webmanifest
├── registerSW.js
├── sw.js
├── robots.txt
├── sitemap.xml
├── icon-192x192.png
├── icon-512x512.png
├── assets/
│   ├── index-BLn_WeW4.css
│   ├── index-CaDov0gr.js
│   ├── vendor-yXRYaY_D.js
│   ├── ui-Gq0NWwj_.js
│   ├── charts-CwRTPBqb.js
│   └── ... (other asset files)
```

## After Deployment

After successful deployment:

1. **Add Environment Variables** in Netlify:
   - Go to Site settings → Environment variables
   - Add all required variables (VITE_SUPABASE_URL, etc.)

2. **Trigger a new deploy** after adding variables

## Troubleshooting

If you're still having issues:

1. **Check the index.html file** - Make sure it's not corrupted and has proper HTML content
2. **Verify folder structure** - The index.html must be at the root level
3. **Try the Netlify CLI** if available on your system:
   ```
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

## Need More Help?

Refer to the [Netlify documentation](https://docs.netlify.com/site-deploys/create-deploys/) for more detailed instructions.