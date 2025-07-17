#!/usr/bin/env node

/**
 * Database Connection and Functionality Test
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testDatabase() {
  console.log('🔍 Testing database connection and functionality...\n');

  const tests = [
    {
      name: 'Connection Test',
      test: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        return 'Database connection successful';
      }
    },
    {
      name: 'Tables Exist',
      test: async () => {
        const tables = ['profiles', 'personas', 'persona_content', 'conversations', 'messages', 'subscriptions'];
        const results = [];
        
        for (const table of tables) {
          try {
            await supabase.from(table).select('count', { count: 'exact', head: true });
            results.push(`✅ ${table}`);
          } catch (error) {
            results.push(`❌ ${table}: ${error.message}`);
          }
        }
        
        return results.join('\n   ');
      }
    },
    {
      name: 'RLS Policies',
      test: async () => {
        // Test that unauthenticated users can't access data
        const { data, error } = await supabase
          .from('profiles')
          .select('*');
        
        // Should return empty or error due to RLS
        if (data && data.length === 0) {
          return 'RLS policies are active (good!)';
        } else if (error && error.message.includes('RLS')) {
          return 'RLS policies are working correctly';
        } else {
          throw new Error('RLS policies may not be configured correctly');
        }
      }
    },
    {
      name: 'Storage Bucket',
      test: async () => {
        const { data, error } = await supabase.storage.listBuckets();
        
        if (error) throw error;
        
        const personaBucket = data.find(bucket => bucket.name === 'persona-content');
        if (!personaBucket) {
          throw new Error('persona-content bucket not found');
        }
        
        return 'Storage bucket configured correctly';
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`🔍 ${test.name}... `);
    
    try {
      const result = await test.test();
      console.log(`✅ ${result}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Database Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 Database is ready for production!');
  } else {
    console.log('⚠️  Please fix database issues before deploying.');
  }
}

testDatabase().catch(console.error);