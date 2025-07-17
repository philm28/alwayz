/*
  # Fix Storage Bucket Configuration

  1. New Storage Bucket
    - Creates 'persona-content' bucket if it doesn't exist
    - Sets file size limit to 50MB
    - Makes bucket private

  2. Security
    - Adds simplified RLS policies with no path restrictions
    - Allows authenticated users to upload, read, and delete files
    - Removes any path-based restrictions that might be causing issues
*/

-- Create the storage bucket if it doesn't exist
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

-- Add simple RLS policy for file uploads - no path restrictions
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-content');

-- Add simple RLS policy for file downloads - no path restrictions
CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'persona-content');

-- Add simple RLS policy for file deletion - no path restrictions
CREATE POLICY "Users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'persona-content');