/*
  # Create Storage Bucket for Persona Content

  1. New Storage
    - Create 'persona-content' bucket for storing uploaded files
    - Set file size limit to 50MB
    - Configure as private bucket

  2. Security
    - Add RLS policies for authenticated users
    - Allow file uploads and downloads
    - Simple policies without path restrictions for easier setup
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

-- Add simple RLS policies for file uploads
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-content');

-- Add simple RLS policies for file downloads
CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'persona-content');

-- Add simple RLS policies for file deletion
CREATE POLICY "Users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'persona-content');