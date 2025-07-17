# Troubleshooting Supabase Storage Issues

If you're experiencing issues with the Supabase storage bucket after following the setup instructions, here are some additional troubleshooting steps:

## Quick Fix: Run This SQL

The fastest way to fix storage issues is to run this SQL in your Supabase SQL Editor:

```sql
-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'persona-content',
  'persona-content', 
  false,
  52428800  -- 50MB in bytes
)
ON CONFLICT (id) DO NOTHING;

-- Remove any existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can upload persona content" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own persona content" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own persona content" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files" ON storage.objects;

-- Add simple RLS policies with no path restrictions
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-content');

CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'persona-content');

CREATE POLICY "Users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'persona-content');
```

## Step-by-Step Verification

If you want to diagnose the issue more thoroughly:

### 1. Verify Bucket Exists

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **Storage** in the left sidebar
4. Confirm that a bucket named `persona-content` exists
5. Verify it's set to **Private** (not public)

### 2. Check RLS Policies

1. Go to the **Policies** tab in Storage
2. Find your `persona-content` bucket
3. Verify these policies exist:
   - "Users can upload files" (INSERT)
   - "Users can read files" (SELECT)
   - "Users can delete files" (DELETE)
4. If they have different names or complex conditions, consider replacing them with the simpler versions above

### 3. Test Authentication

1. Make sure you're logged in to your application
2. Check the browser console for any authentication errors
3. Verify your JWT token is valid

### 4. Simplify File Paths

The most common issue is with file paths. Try modifying your code to use simple file paths:

```javascript
// Instead of nested paths like:
const filePath = `personas/${personaId}/${fileId}`;

// Try a simple flat path:
const filePath = `${Date.now()}-${file.name}`;
```

### 5. Check Browser Console

1. Open your browser's developer tools (F12)
2. Go to the Console tab
3. Look for specific error messages related to storage
4. Common errors include:
   - "Permission denied" - RLS policy issue
   - "Bucket not found" - Bucket doesn't exist
   - "Invalid token" - Authentication issue

## Common Issues and Solutions

### "Bucket not found" Error

**Solution:**
- Create the bucket using the SQL above or through the Supabase UI
- Make sure the name is exactly `persona-content` (case-sensitive)

### "Permission denied" Error

**Solution:**
- Check that you're logged in (authenticated)
- Simplify RLS policies using the SQL above
- Try removing path restrictions in policies

### "Invalid token" or "JWT expired" Error

**Solution:**
- Log out and log back in to refresh your token
- Check that your Supabase URL and anon key are correct

### Upload Works But Files Aren't Visible

**Solution:**
- Check the SELECT policy to ensure it matches the INSERT policy
- Verify the file path being used to retrieve files

### "Network Error" When Uploading

**Solution:**
- Check your internet connection
- Verify Supabase is up and running
- Try a smaller file (under 1MB)

## Still Having Issues?

If you're still experiencing problems after trying all these steps:

1. Go to the "Storage Test" page in your application
2. Run the tests to see detailed error information
3. Try the simple file upload test
4. Check the browser console for specific error messages
5. If needed, delete the bucket completely and recreate it using the SQL above