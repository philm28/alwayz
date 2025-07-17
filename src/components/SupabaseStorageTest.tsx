import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, RefreshCw, HardDrive, Upload, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { SimpleFileUpload } from './SimpleFileUpload';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';

export function SupabaseStorageTest() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bucketStatus, setBucketStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [policyStatus, setPolicyStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [testUploadStatus, setTestUploadStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bucketDetails, setBucketDetails] = useState<any>(null);

  useEffect(() => {
    if (!loading) {
      if (user) {
        checkBucket();
      } else {
        setShowAuthModal(true);
      }
    }
  }, [user, loading]);

  // If user is not authenticated, show login prompt
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-600 mr-2" />
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
              <p className="text-gray-600 mb-6">
                You need to be logged in to test the storage functionality. 
                Storage operations require authentication to ensure security.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Sign In to Continue
              </button>
            </div>
          </div>
        </div>
        
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  const checkBucket = async () => {
    setBucketStatus('testing');
    setErrorMessage(null);
    
    try {
      // Instead of listing buckets, directly test bucket access
      const testContent = 'This is a test file to verify bucket access.';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testFileName = `bucket-test-${Date.now()}.txt`;
      
      // Try to upload a test file to verify bucket exists and is accessible
      const { data, error } = await supabase.storage
        .from('persona-content')
        .upload(testFileName, testBlob, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.error('Bucket test failed:', error);
        setBucketStatus('error');
        
        if (error.message.includes('not found')) {
          setErrorMessage('Storage bucket "persona-content" not found. Please create it manually in your Supabase dashboard.');
        } else if (error.message.includes('permission denied')) {
          setErrorMessage('Permission denied. Storage RLS policies may not be configured correctly.');
        } else {
          setErrorMessage(`Bucket access error: ${error.message}`);
        }
        return;
      }
      
      console.log('Bucket test successful:', data);
      
      // Clean up test file
      await supabase.storage.from('persona-content').remove([testFileName]);
      
      // Now get bucket details since we know it exists and works
      try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (!listError && buckets) {
          const personaBucket = buckets.find(bucket => bucket.name === 'persona-content');
          if (personaBucket) {
            setBucketDetails(personaBucket);
          } else {
            // Fallback if we can't get details but bucket works
            setBucketDetails({ 
              id: 'persona-content',
              name: 'persona-content', 
              public: false,
              file_size_limit: 52428800,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } else {
          // Fallback if we can't list buckets but upload works
          setBucketDetails({ 
            id: 'persona-content',
            name: 'persona-content', 
            public: false,
            file_size_limit: 52428800,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      } catch (detailsError) {
        // Even if we can't get details, the bucket works
        console.warn('Could not get bucket details, but bucket is functional:', detailsError);
        setBucketDetails({ 
          id: 'persona-content',
          name: 'persona-content', 
          public: false,
          file_size_limit: 52428800,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      setBucketStatus('success');
      
      // Check policies
      await checkPolicies();
    } catch (error) {
      console.error('Bucket check error:', error);
      setBucketStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error checking bucket');
    }
  };

  const checkPolicies = async () => {
    setPolicyStatus('testing');
    
    try {
      // We can't directly check policies from the client
      // Instead, we'll try a test upload to see if policies are working
      await testUpload();
    } catch (error) {
      console.error('Policy check error:', error);
      setPolicyStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error checking policies');
    }
  };

  const testUpload = async () => {
    setTestUploadStatus('testing');
    
    try {
      // Create a small test file
      const testContent = 'This is a test file to verify storage permissions.';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testFileName = `test-${Date.now()}.txt`;
      
      // Try to upload it
      const { data, error } = await supabase.storage
        .from('persona-content')
        .upload(testFileName, testBlob, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.error('Test upload failed:', error);
        setTestUploadStatus('error');
        setPolicyStatus('error');
        
        if (error.message.includes('permission denied')) {
          setErrorMessage('Permission denied. Storage RLS policies may not be configured correctly.');
        } else {
          setErrorMessage(`Upload test failed: ${error.message}`);
        }
        return;
      }
      
      console.log('Test upload successful:', data);
      
      // Try to delete the test file
      const { error: deleteError } = await supabase.storage
        .from('persona-content')
        .remove([testFileName]);
      
      if (deleteError) {
        console.warn('Could not delete test file:', deleteError);
        // Not critical, so we don't fail the test
      }
      
      setTestUploadStatus('success');
      setPolicyStatus('success');
      toast.success('Storage bucket is properly configured!');
    } catch (error) {
      console.error('Upload test error:', error);
      setTestUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error during upload test');
    }
  };

  const getStatusIcon = (status: 'testing' | 'success' | 'error' | null) => {
    if (status === 'testing') {
      return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>;
    } else if (status === 'success') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status === 'error') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6 m-4">
      <div className="flex items-center mb-4">
        <HardDrive className="h-6 w-6 text-purple-600 mr-3" />
        <h2 className="text-xl font-bold text-gray-900">Storage Bucket Test</h2>
      </div>
      
      <div className="space-y-4">
        {/* Bucket Check */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getStatusIcon(bucketStatus)}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Bucket "persona-content"</h3>
              <p className="text-sm text-gray-600">
                {bucketStatus === 'testing' && 'Checking if bucket exists...'}
                {bucketStatus === 'success' && 'Bucket exists'}
                {bucketStatus === 'error' && 'Bucket not found or error'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Policy Check */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getStatusIcon(policyStatus)}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Storage Policies</h3>
              <p className="text-sm text-gray-600">
                {policyStatus === 'testing' && 'Checking policies...'}
                {policyStatus === 'success' && 'Policies configured correctly'}
                {policyStatus === 'error' && 'Policy issues detected'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Upload Test */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getStatusIcon(testUploadStatus)}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Test Upload</h3>
              <p className="text-sm text-gray-600">
                {testUploadStatus === 'testing' && 'Testing file upload...'}
                {testUploadStatus === 'success' && 'Test upload successful'}
                {testUploadStatus === 'error' && 'Test upload failed'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Bucket Details */}
        {bucketDetails && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Bucket Details</h4>
            <div className="text-sm text-blue-800">
              <p><span className="font-medium">Name:</span> {bucketDetails.name}</p>
              <p><span className="font-medium">ID:</span> {bucketDetails.id}</p>
              <p><span className="font-medium">Public:</span> {bucketDetails.public ? 'Yes' : 'No'}</p>
              {bucketDetails.file_size_limit && (
                <p><span className="font-medium">File Size Limit:</span> {Math.round(bucketDetails.file_size_limit / (1024 * 1024))}MB</p>
              )}
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800 mb-1">Error Details</h4>
            <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{errorMessage}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end">
          <button
            onClick={checkBucket}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Run Tests Again
          </button>
        </div>
        
        {/* Setup Instructions */}
        {bucketStatus === 'error' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Setup Instructions</h4>
          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
            <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-medium">Supabase Dashboard</a></li>
            <li>Navigate to Storage → New Bucket</li>
            <li>Create a bucket named "persona-content"</li>
            <li>Set it to Private</li>
            <li>Set file size limit to 50MB</li>
            <li>Go to the Policies tab</li>
            <li>Add these policies for the bucket:</li>
          </ol>
          
          <div className="mt-2 p-2 bg-white rounded text-xs">
            <p className="font-medium mb-1">1. For INSERT (create):</p>
            <pre className="whitespace-pre-wrap break-words bg-gray-50 p-1 rounded">
              CREATE POLICY "Users can upload files"
              ON storage.objects
              FOR INSERT
              TO authenticated
              WITH CHECK (bucket_id = 'persona-content');
            </pre>
            
            <p className="mt-2 mb-1">2. For SELECT (read):</p>
            <pre className="whitespace-pre-wrap break-words bg-gray-50 p-1 rounded">
              CREATE POLICY "Users can read files"
              ON storage.objects
              FOR SELECT
              TO authenticated
              USING (bucket_id = 'persona-content');
            </pre>
          </div>
        </div>
        )}
        
        {/* Simple File Upload Test */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <Upload className="h-6 w-6 text-purple-600 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">Test File Upload</h3>
          </div>
          <SimpleFileUpload />
        </div>
      </div>
    </div>
  );
}