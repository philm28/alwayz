/*
  # Add metadata column to personas table

  1. Changes
    - Add metadata jsonb column to personas table with default empty object
    - This column is required for storing additional persona-related data

  2. Safety
    - Uses IF NOT EXISTS equivalent check to avoid errors if column already exists
    - Sets appropriate default value
*/

-- Add metadata column to personas table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personas' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE personas ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;