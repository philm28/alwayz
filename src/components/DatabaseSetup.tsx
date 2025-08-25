import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { testConnection, setupDatabase } from '../utils/setupDatabase';

export function DatabaseSetup() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [setupStatus, setSetupStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnectionStatus('testing');
    const success = await testConnection();
    setConnectionStatus(success ? 'success' : 'error');
    
    if (success) {
      checkDatabase();
    }
  };

  const checkDatabase = async () => {
    setSetupStatus('testing');
    const success = await setupDatabase();
    setSetupStatus(success ? 'success' : 'error');
    
    if (!success) {
      setShowMigration(true);
    }
  };

  const copyMigration = () => {
    const migrationSQL = `-- Copy this SQL and run it in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi/sql

/*
  # Initial AlwayZ Database Schema

  1. New Tables
    - profiles - User profile information
    - personas - AI personas created by users
    - persona_content - Uploaded content for training personas
    - conversations - Chat/call sessions between users and personas
    - messages - Individual messages within conversations
    - subscriptions - User subscription management

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Secure file uploads and content access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  subscription_tier text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create personas table
CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  description text,
  personality_traits text,
  common_phrases text[],
  avatar_url text,
  voice_model_id text,
  status text DEFAULT 'training',
  training_progress integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create persona content table for uploaded training data
CREATE TABLE IF NOT EXISTS "persona-content" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  file_url text,
  file_name text,
  file_size bigint,
  content_text text,
  metadata jsonb DEFAULT '{}',
  processing_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE,
  title text,
  conversation_type text DEFAULT 'chat',
  duration_seconds integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  audio_url text,
  video_url text,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_name text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE "persona-content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own personas" ON personas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create personas" ON personas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personas" ON personas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own personas" ON personas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can read own persona content" ON "persona-content" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM personas WHERE personas.id = "persona-content".persona_id AND personas.user_id = auth.uid()));
CREATE POLICY "Users can upload persona content" ON "persona-content" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM personas WHERE personas.id = "persona-content".persona_id AND personas.user_id = auth.uid()));

CREATE POLICY "Users can read own conversations" ON conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read messages from own conversations" ON messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Users can create messages in own conversations" ON messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));

CREATE POLICY "Users can read own subscription" ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_content_persona_id ON "persona-content"(persona_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_persona_id ON conversations(persona_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

    navigator.clipboard.writeText(migrationSQL);
    alert('Migration SQL copied to clipboard!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <div className="text-center mb-8">
          <Database className="h-16 w-16 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Database Setup</h2>
          <p className="text-gray-600">Setting up your Supabase database for AlwayZ</p>
        </div>

        <div className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {connectionStatus === 'testing' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                )}
                {connectionStatus === 'success' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {connectionStatus === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Supabase Connection</h3>
                <p className="text-sm text-gray-600">
                  {connectionStatus === 'testing' && 'Testing connection...'}
                  {connectionStatus === 'success' && 'Connected successfully'}
                  {connectionStatus === 'error' && 'Connection failed'}
                </p>
              </div>
            </div>
            <button
              onClick={checkConnection}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Test Again
            </button>
          </div>

          {/* Database Status */}
          {connectionStatus === 'success' && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {setupStatus === 'testing' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  )}
                  {setupStatus === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {setupStatus === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Database Tables</h3>
                  <p className="text-sm text-gray-600">
                    {setupStatus === 'testing' && 'Checking database schema...'}
                    {setupStatus === 'success' && 'All tables are ready'}
                    {setupStatus === 'error' && 'Tables need to be created'}
                  </p>
                </div>
              </div>
              <button
                onClick={checkDatabase}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Check Again
              </button>
            </div>
          )}

          {/* Migration Instructions */}
          {showMigration && (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-yellow-800 mb-2">Database Migration Required</h3>
                  <p className="text-yellow-700 mb-4">
                    Your database tables haven't been created yet. Follow these steps:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-yellow-700 mb-4">
                    <li>Click the button below to copy the migration SQL</li>
                    <li>Go to your <a href="https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi/sql" target="_blank" rel="noopener noreferrer" className="underline font-medium">Supabase SQL Editor</a></li>
                    <li>Paste the SQL and click "Run"</li>
                    <li>Come back here and click "Check Again"</li>
                  </ol>
                  <button
                    onClick={copyMigration}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Migration SQL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {setupStatus === 'success' && (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-800">Database Ready!</h3>
                  <p className="text-green-700">
                    Your Supabase database is fully configured and ready to use. You can now create accounts, personas, and start conversations!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}