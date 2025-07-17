# Database Migration Guide

## What This Migration Creates

This migration will create 6 essential tables for your AlwayZ application:

### 1. **profiles** - User Information
- Stores user profile data (name, email, subscription tier)
- Links to Supabase Auth users

### 2. **personas** - AI Personas
- Stores AI persona information (name, personality, training status)
- Each user can have multiple personas

### 3. **persona_content** - Training Data
- Stores uploaded files (videos, audio, photos, documents)
- Used to train the AI personas

### 4. **conversations** - Chat Sessions
- Tracks conversations between users and personas
- Stores conversation metadata and duration

### 5. **messages** - Individual Messages
- Stores each message in conversations
- Supports text, audio, and video messages

### 6. **subscriptions** - Payment Management
- Tracks user subscriptions and billing
- Integrates with Stripe

## Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi/sql
2. Click "New Query" or use the existing editor

### Step 2: Copy and Paste the Migration
Copy the ENTIRE content from the file: `supabase/migrations/20250626224737_ancient_summit.sql`

**Important**: Copy everything from the first `/*` comment to the very last line.

### Step 3: Run the Migration
1. Paste the SQL into the editor
2. Click "Run" button (usually blue button in the interface)
3. Wait for it to complete (should take 10-30 seconds)

### Step 4: Verify Success
After running, you should see:
- ✅ "Success. No rows returned" or similar message
- No error messages in red

### Step 5: Check Your Tables
1. Go to "Table Editor" in the left sidebar
2. You should see 6 new tables:
   - profiles
   - personas
   - persona_content
   - conversations
   - messages
   - subscriptions

## What If Something Goes Wrong?

### Common Issues:

1. **"relation already exists" error**
   - This means tables already exist
   - You can safely ignore this error

2. **Permission denied errors**
   - Make sure you're logged into the correct Supabase project
   - Check that you have admin access

3. **Syntax errors**
   - Make sure you copied the ENTIRE migration file
   - Don't modify the SQL content

### Getting Help:
If you encounter issues:
1. Check the error message carefully
2. Try refreshing the Supabase dashboard
3. Make sure you're in the correct project

## After Migration Success

Once your migration runs successfully:

1. **Row Level Security (RLS) is enabled** - This protects user data
2. **Policies are created** - Users can only access their own data
3. **Indexes are added** - For better performance
4. **Triggers are set up** - For automatic timestamp updates

Your database is now ready for your AlwayZ application! 🎉