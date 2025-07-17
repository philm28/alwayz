# Setting Up Your Supabase Database for AlwayZ

This guide will walk you through setting up the database for your AlwayZ application in Supabase.

## Step 1: Access Your Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one if you haven't already)
3. Note your project URL and anon key for later use in environment variables

## Step 2: Run the Database Migration

1. In the Supabase dashboard, navigate to the **SQL Editor** section
2. Click **New Query**
3. Copy the ENTIRE content from the migration file located at:
   `supabase/migrations/20250626224737_ancient_summit.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the migration

This migration will create all necessary tables:
- `profiles` - User profile information
- `personas` - AI personas created by users
- `persona_content` - Training data for personas
- `conversations` - Chat sessions
- `messages` - Individual messages
- `subscriptions` - Payment management

## Step 3: Verify Database Setup

After running the migration:

1. Go to the **Table Editor** in the Supabase dashboard
2. You should see all 6 tables created
3. Check that Row Level Security (RLS) is enabled for all tables
4. Verify that the appropriate policies are in place

## Step 4: Set Up Storage Bucket

1. Go to the **Storage** section in Supabase
2. Create a new bucket named `persona-content`
3. Set the privacy level to **Private**
4. Add appropriate RLS policies for file access:

```sql
-- Example policy to allow users to upload their own files
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-content' AND auth.uid() = owner);

-- Example policy to allow users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'persona-content' AND auth.uid() = owner);
```

## Step 5: Test Database Connection

To test if your database is properly set up:

1. Go to your deployed AlwayZ application
2. Navigate to the Database Setup page
3. Click "Test Connection"
4. If successful, you'll see "Connected successfully"
5. If you encounter errors, check your environment variables and Supabase settings

## Troubleshooting

If you encounter issues:

- **"Relation does not exist" error**: Make sure you've run the full migration script
- **Permission denied errors**: Check that RLS policies are correctly set up
- **Connection errors**: Verify your Supabase URL and anon key in environment variables

For more detailed database information, refer to the `DATABASE_MIGRATION_GUIDE.md` file in your project.