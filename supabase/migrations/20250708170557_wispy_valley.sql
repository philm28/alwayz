/*
  # Create Storage Bucket for Persona Content

  1. New Storage Configuration
    - Creates the 'persona-content' bucket for storing persona files
    - Sets file size limit to 50MB
    - Configures as private bucket (not public)

  2. Security
    - Adds RLS policies for authenticated users to:
      - Upload their own files
      - Read their own files
      - Delete their own files
    - Ensures proper path structure for security
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

-- Add RLS policies for the bucket
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