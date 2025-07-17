# 🚀 Deploy AlwayZ to Netlify - Step by Step

## The Problem
You're seeing the error: "Please drop a folder containing an index.html file"

This happens when Netlify can't find an index.html file at the root level of what you're uploading.

## Solution: Upload the ENTIRE dist folder

### Method 1: Drag & Drop the Folder (Recommended)

1. **Build your application**:
   ```bash
   npm run build
   ```

2. **Find the dist folder** in your project directory

3. **Drag and drop the ENTIRE dist folder** to Netlify:
   - Go to [netlify.com](https://app.netlify.com/) and log in
   - Look for the upload area (it says "Drag and drop your site folder here")
   - **IMPORTANT**: Drag the entire `dist` folder itself, not the files inside it
   - The folder structure should look like:
     ```
     dist/
     ├── index.html  <-- This must be at the root level of what you upload
     ├── assets/
     │   ├── index-BLn_WeW4.css
     │   ├── index-CaDov0gr.js
     │   └── ... (other files)
     ├── manifest.webmanifest
     └── ... (other files)
     ```

### Method 2: Create a ZIP File

If dragging the folder doesn't work:

1. **Right-click on the dist folder** and select "Compress" or "Create archive"
2. **Upload the ZIP file** to Netlify

### Method 3: Manual Upload

If you're still having trouble:

1. **Create a new empty folder** on your computer named "netlify-upload"
2. **Copy everything from the dist folder** into this new folder
3. **Drag and drop the netlify-upload folder** to Netlify

## After Successful Upload

Once your site is deployed:

1. **Add Environment Variables** in Netlify:
   - Go to Site settings → Environment variables
   - Add all required variables (VITE_SUPABASE_URL, etc.)

2. **Trigger a new deploy** after adding variables

## Still Having Issues?

If you're still seeing the error:

1. **Check that index.html exists** in your dist folder
2. **Verify the file structure** matches what Netlify expects
3. **Try using the Netlify CLI** if available on your system:
   ```
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

Need more help? Contact Netlify support or check their documentation at [docs.netlify.com](https://docs.netlify.com/site-deploys/create-deploys/).