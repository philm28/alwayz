/*
  # Social Media Connections

  1. New Tables
    - `social_media_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - Links to auth.users
      - `persona_id` (uuid, foreign key) - Links to personas table
      - `platform` (text) - Platform name: facebook, instagram, twitter, etc.
      - `access_token` (text) - Encrypted OAuth access token
      - `refresh_token` (text) - Encrypted OAuth refresh token
      - `token_expires_at` (timestamptz) - When the token expires
      - `platform_user_id` (text) - User ID on the platform
      - `platform_username` (text) - Username on the platform
      - `last_sync` (timestamptz) - Last time data was synced
      - `posts_imported` (int) - Number of posts imported
      - `status` (text) - Connection status: active, expired, revoked
      - `metadata` (jsonb) - Additional platform-specific data
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `social_media_connections` table
    - Add policies for authenticated users to manage their connections

  3. Indexes
    - Create indexes for efficient querying
*/

-- Create social_media_connections table
CREATE TABLE IF NOT EXISTS social_media_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  platform_user_id text,
  platform_username text,
  last_sync timestamptz,
  posts_imported int DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, persona_id, platform)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_media_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_persona_id ON social_media_connections(persona_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_media_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_status ON social_media_connections(status);
CREATE INDEX IF NOT EXISTS idx_social_connections_last_sync ON social_media_connections(last_sync DESC);

-- Enable Row Level Security
ALTER TABLE social_media_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own social media connections"
  ON social_media_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social media connections"
  ON social_media_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social media connections"
  ON social_media_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social media connections"
  ON social_media_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_social_connections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_social_connections_timestamp
  BEFORE UPDATE ON social_media_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_social_connections_timestamp();

-- Create table for social media sync jobs
CREATE TABLE IF NOT EXISTS social_media_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES social_media_connections(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  items_processed int DEFAULT 0,
  memories_extracted int DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for sync jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection_id ON social_media_sync_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON social_media_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_persona_id ON social_media_sync_jobs(persona_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON social_media_sync_jobs(status);

-- Enable RLS on sync jobs
ALTER TABLE social_media_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync jobs"
  ON social_media_sync_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get active connections for a persona
CREATE OR REPLACE FUNCTION get_active_social_connections(query_persona_id uuid)
RETURNS TABLE (
  id uuid,
  platform text,
  platform_username text,
  last_sync timestamptz,
  posts_imported int,
  status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    smc.id,
    smc.platform,
    smc.platform_username,
    smc.last_sync,
    smc.posts_imported,
    smc.status
  FROM social_media_connections smc
  WHERE smc.persona_id = query_persona_id
    AND smc.status = 'active'
  ORDER BY smc.last_sync DESC NULLS LAST;
END;
$$;

-- Function to check if sync is needed
CREATE OR REPLACE FUNCTION needs_sync(
  query_connection_id uuid,
  sync_interval_hours int DEFAULT 24
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  last_sync_time timestamptz;
BEGIN
  SELECT last_sync INTO last_sync_time
  FROM social_media_connections
  WHERE id = query_connection_id;

  IF last_sync_time IS NULL THEN
    RETURN true;
  END IF;

  RETURN (now() - last_sync_time) > (sync_interval_hours || ' hours')::interval;
END;
$$;
