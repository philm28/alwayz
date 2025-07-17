# Detailed Supabase Storage Bucket Setup for AlwayZ

This guide provides step-by-step instructions with screenshots to set up the required storage bucket for your AlwayZ application.

## The Problem

Your application is showing this error:
```
Storage bucket "persona-content" not found. Please create it manually in your Supabase dashboard under Storage > New Bucket with a 50MB file size limit.
```

This happens because the `FileUpload` component is trying to use a storage bucket that doesn't exist yet.

## Step 1: Access Supabase Storage

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **Storage** in the left sidebar

![Supabase Dashboard Navigation](https://images.pexels.com/photos/5483077/pexels-photo-5483077.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)

## Step 2: Create the Bucket

1. Click the **New Bucket** button
2. In the dialog that appears, enter:
   - **Name**: `persona-content` (exactly as shown, case-sensitive)
   - **Public bucket**: Uncheck this (should be Private)
   - **File size limit**: 50MB
3. Click **Create bucket**

![Create Bucket Dialog](https://images.pexels.com/photos/5483064/pexels-photo-5483064.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)

## Step 3: Set Up RLS Policies

After creating the bucket, you need to add security policies:

1. Click on the **Policies** tab (still in Storage section)
2. Find your `persona-content` bucket in the list
3. Click **New Policy** button

### Policy 1: Allow Users to Upload Their Own Files

1. Select **For authenticated users only**
2. Choose **Insert (create)** operation
3. Enter a policy name: "Users can upload persona content"
4. In the policy definition, enter:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```
5. Click **Save Policy**

### Policy 2: Allow Users to Read Their Own Files

1. Click **New Policy** again
2. Select **For authenticated users only**
3. Choose **Select (read)** operation
4. Enter a policy name: "Users can read own persona content"
5. In the policy definition, enter:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```
6. Click **Save Policy**

### Policy 3: Allow Users to Delete Their Own Files

1. Click **New Policy** again
2. Select **For authenticated users only**
3. Choose **Delete** operation
4. Enter a policy name: "Users can delete own persona content"
5. In the policy definition, enter:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```
6. Click **Save Policy**

## Step 4: Alternative - Using SQL Editor

If you prefer to set everything up via SQL:

1. Go to the **SQL Editor** in Supabase
2. Create a new query
3. Paste and run this SQL:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'persona-content',
  'persona-content', 
  false,
  52428800  -- 50MB in bytes
)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies
CREATE POLICY "Users can upload persona content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own persona content"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own persona content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Step 5: Verify Setup

After completing the setup:

1. Go back to your AlwayZ application
2. Refresh the page
3. Try uploading a file to a persona
4. The upload should now work without the "Bucket not found" error

## Common Issues and Solutions

### "Bucket already exists" Error
If you get this error when running the SQL, it means the bucket was already created. You can ignore this error and proceed with setting up the policies.

### "Permission denied" Errors
If you get permission errors when uploading:
1. Make sure you're logged in to your application
2. Check that the RLS policies are correctly set up
3. Verify the file path structure in your code matches what the policies expect

### File Upload Still Fails
If uploads still fail after creating the bucket:
1. Check browser console for specific error messages
2. Verify the bucket name is exactly `persona-content` (case-sensitive)
3. Make sure your Supabase URL and anon key are correct in your environment variables

### File Size Issues
- The 50MB limit is set to work reliably with Supabase
- If you need to upload larger files, you'll need to:
  1. Increase the bucket file size limit in Supabase
  2. Update the maxSize parameter in your FileUpload component
  3. Consider implementing chunked uploads for very large files

## Need More Help?

If you're still experiencing issues:
1. Check the Supabase logs for any errors
2. Look at the browser console for detailed error messages
3. Verify your Supabase project has sufficient storage quota
4. Ensure your authentication is working correctly