/*
  # Memory System with Vector Embeddings

  1. New Tables
    - `persona_memories`
      - `id` (text, primary key) - Unique memory identifier
      - `persona_id` (uuid, foreign key) - Links to personas table
      - `content` (text) - The actual memory content
      - `memory_type` (text) - Type: fact, experience, preference, relationship, skill, emotion
      - `source_type` (text) - Source: video, image, audio, text, social_media
      - `source_url` (text) - URL of original content
      - `importance` (float) - Importance score 0-1
      - `embedding` (vector) - Vector embedding for similarity search
      - `metadata` (jsonb) - Additional structured data
      - `created_at` (timestamptz) - When memory was created
      - `updated_at` (timestamptz) - Last update time

  2. Extensions
    - Enable pgvector extension for vector similarity search

  3. Security
    - Enable RLS on `persona_memories` table
    - Add policies for authenticated users to manage their persona memories

  4. Functions
    - Create function for vector similarity search
    - Create function for memory relevance scoring
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create persona_memories table
CREATE TABLE IF NOT EXISTS persona_memories (
  id text PRIMARY KEY,
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN ('fact', 'experience', 'preference', 'relationship', 'skill', 'emotion')),
  source_type text NOT NULL CHECK (source_type IN ('video', 'image', 'audio', 'text', 'social_media')),
  source_url text,
  importance float NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_persona_memories_persona_id ON persona_memories(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_memories_memory_type ON persona_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_persona_memories_source_type ON persona_memories(source_type);
CREATE INDEX IF NOT EXISTS idx_persona_memories_importance ON persona_memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_persona_memories_created_at ON persona_memories(created_at DESC);

-- Create vector similarity index using HNSW (Hierarchical Navigable Small World)
CREATE INDEX IF NOT EXISTS idx_persona_memories_embedding ON persona_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Enable Row Level Security
ALTER TABLE persona_memories ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view memories for their personas"
  ON persona_memories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_memories.persona_id
      AND personas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert memories for their personas"
  ON persona_memories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_memories.persona_id
      AND personas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update memories for their personas"
  ON persona_memories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_memories.persona_id
      AND personas.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_memories.persona_id
      AND personas.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete memories for their personas"
  ON persona_memories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_memories.persona_id
      AND personas.user_id = auth.uid()
    )
  );

-- Function to search memories using vector similarity
CREATE OR REPLACE FUNCTION search_memories(
  query_persona_id uuid,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  persona_id uuid,
  content text,
  memory_type text,
  source_type text,
  source_url text,
  importance float,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.persona_id,
    pm.content,
    pm.memory_type,
    pm.source_type,
    pm.source_url,
    pm.importance,
    pm.metadata,
    pm.created_at,
    1 - (pm.embedding <=> query_embedding) as similarity
  FROM persona_memories pm
  WHERE pm.persona_id = query_persona_id
    AND 1 - (pm.embedding <=> query_embedding) > match_threshold
  ORDER BY pm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get most important memories
CREATE OR REPLACE FUNCTION get_important_memories(
  query_persona_id uuid,
  limit_count int DEFAULT 20
)
RETURNS TABLE (
  id text,
  persona_id uuid,
  content text,
  memory_type text,
  source_type text,
  importance float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.persona_id,
    pm.content,
    pm.memory_type,
    pm.source_type,
    pm.importance,
    pm.metadata,
    pm.created_at
  FROM persona_memories pm
  WHERE pm.persona_id = query_persona_id
  ORDER BY pm.importance DESC, pm.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to update memory timestamp
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_persona_memories_timestamp
  BEFORE UPDATE ON persona_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_timestamp();

-- Create table for memory processing status
CREATE TABLE IF NOT EXISTS memory_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
  content_id uuid REFERENCES persona_content(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message text,
  memories_extracted int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create index on processing jobs
CREATE INDEX IF NOT EXISTS idx_memory_jobs_persona_id ON memory_processing_jobs(persona_id);
CREATE INDEX IF NOT EXISTS idx_memory_jobs_status ON memory_processing_jobs(status);

-- Enable RLS on memory_processing_jobs
ALTER TABLE memory_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their memory processing jobs"
  ON memory_processing_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = memory_processing_jobs.persona_id
      AND personas.user_id = auth.uid()
    )
  );
