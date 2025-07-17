import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function SupabaseConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState<string | null>(null);

  useEffect(() => {
    // Display the Supabase URL (without the key)
    setSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || 'Not configured');
    
    // Test connection on component mount
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage(null);
    
    try {
      // Simple query to test connection
      const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('Connection test failed:', error);
        setConnectionStatus('error');
        setErrorMessage(error.message);
        return;
      }
      
      setConnectionStatus('success');
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6 m-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Supabase Connection Test</h2>
      
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700">Supabase URL:</p>
        <p className="text-sm text-gray-600 break-all">{supabaseUrl}</p>
      </div>
      
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
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
            <h3 className="font-medium text-gray-900">Connection Status</h3>
            <p className="text-sm text-gray-600">
              {connectionStatus === 'testing' && 'Testing connection...'}
              {connectionStatus === 'success' && 'Connected successfully'}
              {connectionStatus === 'error' && 'Connection failed'}
            </p>
          </div>
        </div>
        <button
          onClick={testConnection}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Test
        </button>
      </div>
      
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-1">Error Details</h4>
          <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{errorMessage}</p>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p>If the connection fails, check your environment variables in Netlify:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Go to your Netlify site dashboard</li>
          <li>Navigate to Site settings → Environment variables</li>
          <li>Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly</li>
          <li>Trigger a new deploy after updating variables</li>
        </ol>
      </div>
    </div>
  );
}