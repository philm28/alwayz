/*
  # Allow Public Read Access for Persona Content Storage

  1. Storage Policy Update
    - Drop existing authenticated-only read policy
    - Create new policy allowing public read access
    - Keep upload and delete restricted to authenticated users

  2. Security
    - Maintains security for uploads and deletions
    - Allows public read access for browser image loading
    - Fixes "Failed to load image" errors in the application
*/

-- Drop the existing authenticated-only read policy
DROP POLICY IF EXISTS "Users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own persona content" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;

-- Create new policy allowing public read access for persona-content bucket
CREATE POLICY "Allow public read access to persona content"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'persona-content');