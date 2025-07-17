# Supabase Storage Setup for AlwayZ

This guide will help you set up the required storage bucket for file uploads in your AlwayZ application.

## Quick Setup Steps

### 1. Access Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your AlwayZ project
3. Navigate to **Storage** in the left sidebar

### 2. Create Storage Bucket
1. Click **New Bucket**
2. Set the following configuration:
   - **Name**: `persona-content`
   - **Privacy**: **Private** (important for security)
   - **File size limit**: 50MB (reduced from 100MB to avoid Supabase limits)
   - **Allowed MIME types**: Leave empty (we'll handle this in code)

### 3. Set Up Storage Policies

After creating the bucket, you need to add Row Level Security (RLS) policies:

1. Go to **Storage** → **Policies**
2. Click **New Policy** for the `persona-content` bucket
3. Add the following policies:

#### Policy 1: Allow Users to Upload Their Own Files
```sql
CREATE POLICY "Users can upload persona content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Policy 2: Allow Users to Read Their Own Files
```sql
CREATE POLICY "Users can read own persona content"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Policy 3: Allow Users to Delete Their Own Files
```sql
CREATE POLICY "Users can delete own persona content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'persona-content' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Alternative: SQL Editor Setup

If you prefer to set everything up via SQL, go to **SQL Editor** and run:

```sql
-- Create the storage bucket (if not already created via UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'persona-content',
  'persona-content', 
  false,
  52428800, -- 50MB in bytes (reduced from 100MB)
  ARRAY['video/*', 'audio/*', 'image/*', 'text/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

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

## Verification

After setup:

1. Go back to your AlwayZ application
2. Try uploading a file to a persona (max 50MB)
3. The upload should now work without the "Bucket not found" error

## Troubleshooting

### "Bucket not found" Error
- Ensure the bucket name is exactly `persona-content`
- Check that the bucket exists in your Supabase Storage dashboard

### "Permission denied" Errors
- Verify that RLS policies are correctly set up
- Make sure users are authenticated when uploading
- Check that the file path structure matches the policy expectations

### File Upload Fails / "Payload too large" Error
- Check file size (must be under 50MB)
- Verify file type is supported
- Ensure your Supabase project has sufficient storage quota
- If you need larger files, contact Supabase support to increase limits

### File Size Limit Notes
- The 50MB limit is set to work reliably with most Supabase plans
- If you need larger files, you may need to:
  1. Upgrade your Supabase plan
  2. Contact Supabase support to increase bucket limits
  3. Consider using chunked uploads for very large files

## File Organization

Files are organized in the bucket as:
```
persona-content/
├── personas/
│   ├── {persona-id}/
│   │   ├── {timestamp}-{filename}
│   │   └── ...
│   └── ...
```

This structure ensures each persona's content is isolated and users can only access their own files.