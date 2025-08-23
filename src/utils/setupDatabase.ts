import { supabase } from '../lib/supabase';

export async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Connection error:', error);
    return false;
  }
}

export async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Test if tables exist by trying to query personas first
    const { error: personasError } = await supabase.from('personas').select('count', { count: 'exact', head: true });
    
    if (personasError && personasError.code === '42P01') {
      console.log('❌ Database tables not found. Please run the migration in Supabase SQL Editor.');
      console.log('📋 Copy the migration file content from: supabase/migrations/20250626224737_ancient_summit.sql');
      return false;
    }
    
    // Test persona_content table specifically
    const { error: contentError } = await supabase.from('persona_content').select('count', { count: 'exact', head: true });
    
    if (contentError && contentError.code === '42P01') {
      console.log('❌ persona_content table not found. Please run the migration in Supabase SQL Editor.');
      console.log('📋 Copy the migration file content from: supabase/migrations/20250626224737_ancient_summit.sql');
      return false;
    }
    
    if (personasError || contentError) {
      console.error('Database setup error:', personasError || contentError);
      return false;
    }
    
    // Test storage bucket access directly instead of listing buckets
    try {
      const testFileName = `setup-test-${Date.now()}.txt`;
      const { error: storageError } = await supabase.storage
        .from('persona-content')
        .upload(testFileName, new Blob(['test']), {
          cacheControl: '3600',
          upsert: true
        });

      if (storageError) {
        if (storageError.message.includes('not found')) {
          console.log('❌ Storage bucket "persona-content" not found. Please create it in Supabase dashboard.');
        } else {
          console.error('Storage bucket access error:', storageError);
        }
        return false;
      }
      
      // Clean up test file
      await supabase.storage.from('persona-content').remove([testFileName]);
    } catch (storageError) {
      console.error('Storage bucket check error:', storageError);
      return false;
    }
    
    console.log('✅ Database and storage are ready!');
    return true;
  } catch (error) {
    console.error('Setup error:', error);
    return false;
  }
}