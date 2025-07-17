# Simplified Supabase Storage Setup for AlwayZ

This guide provides the exact steps needed to fix the file upload issue in your AlwayZ application.

## Step 1: Create the Storage Bucket

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (AlwayZ - AI Persona Memorial Platform)
3. Click on **Storage** in the left sidebar
4. Click the **New Bucket** button
5. Enter these exact settings:
   - **Name**: `persona-content` (exactly as shown, case-sensitive)
   - **Public bucket**: Uncheck this (should be Private)
   - **File size limit**: 50MB
6. Click **Create bucket**

## Step 2: Add RLS Policies

After creating the bucket, you need to add security policies:

1. Click on the **Policies** tab (still in Storage section)
2. Find your `persona-content` bucket in the list
3. Click **New Policy** button

### Policy 1: Allow Users to Upload Files

1. Select **For authenticated users only**
2. Choose **INSERT (create)** operation
3. Enter a policy name: "Users can upload files"
4. In the policy definition, enter:
```sql
bucket_id = 'persona-content'
```
5. Click **Save Policy**

### Policy 2: Allow Users to Read Files

1. Click **New Policy** again
2. Select **For authenticated users only**
3. Choose **SELECT (read)** operation
4. Enter a policy name: "Users can read files"
5. In the policy definition, enter:
```sql
bucket_id = 'persona-content'
```
6. Click **Save Policy**

## Step 3: Test Your Setup

After completing the setup:

1. Go back to your AlwayZ application
2. Navigate to the "Storage Test" page
3. Click "Run Tests Again"
4. All three tests should pass
5. Try uploading a file to a persona

## Alternative: Run SQL Migration

If you prefer to set up via SQL:

1. Go to the **SQL Editor** in Supabase
2. Create a new query
3. Copy and paste the SQL from the `supabase/migrations/20250701000000_create_storage_bucket.sql` file
4. Run the query

This will create the bucket and set up the necessary policies in one step.