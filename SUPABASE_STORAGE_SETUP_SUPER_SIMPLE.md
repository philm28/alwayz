# Super Simple Supabase Storage Setup

Follow these exact steps to fix your file upload issue:

## Step 1: Create the Bucket

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Storage** in the left sidebar
4. Click **New Bucket**
5. Enter:
   - Name: `persona-content` (exactly as shown)
   - Uncheck "Public bucket" (make it private)
   - File size limit: 50MB
6. Click **Create bucket**

## Step 2: Add Simple Policies

1. Click the **Policies** tab
2. Find your `persona-content` bucket
3. Click **New Policy**

### First Policy (Upload)
1. Select **For authenticated users only**
2. Choose **INSERT** operation
3. Name: "Users can upload files"
4. Policy: `bucket_id = 'persona-content'`
5. Click **Save Policy**

### Second Policy (Read)
1. Click **New Policy** again
2. Select **For authenticated users only**
3. Choose **SELECT** operation
4. Name: "Users can read files"
5. Policy: `bucket_id = 'persona-content'`
6. Click **Save Policy**

## Step 3: Test It

1. Go back to your AlwayZ app
2. Refresh the page
3. Try uploading a file

That's it! This simplified approach should work immediately.

## Still Having Issues?

If you're still having problems:
1. Make sure you're logged in to your app
2. Check that the bucket name is exactly `persona-content`
3. Try a small JPEG file first (under 1MB)
4. Check browser console for specific error messages