/*
  # Add gender field to personas

  1. Changes
    - Add `gender` column to `personas` table
    - Values can be 'male', 'female', or null for unspecified
    - This enables gender-appropriate voice selection

  2. Security
    - No RLS changes needed (inherits from table)
*/

-- Add gender column to personas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personas' AND column_name = 'gender'
  ) THEN
    ALTER TABLE personas ADD COLUMN gender text CHECK (gender IN ('male', 'female'));
  END IF;
END $$;
