import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function SimpleFileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadResult(null);
    
    try {
      // Create a simple file path - no folders
      const fileName = `test-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      console.log('Uploading file:', fileName);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('persona-content')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.error('Upload error:', error);
        setUploadResult({
          success: false,
          error: error.message
        });
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      
      console.log('Upload successful:', data);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('persona-content')
        .getPublicUrl(fileName);
      
      setUploadResult({
        success: true,
        url: publicUrl
      });
      
      toast.success('File uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Simple File Upload Test</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select a file to upload
        </label>
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-purple-50 file:text-purple-700
            hover:file:bg-purple-100"
        />
      </div>
      
      <button
        onClick={uploadFile}
        disabled={!file || uploading}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center"
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </>
        )}
      </button>
      
      {uploadResult && (
        <div className={`mt-4 p-4 rounded-lg ${
          uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start">
            {uploadResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <div>
              <h4 className={`font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {uploadResult.success ? 'Upload Successful' : 'Upload Failed'}
              </h4>
              {uploadResult.success ? (
                <div>
                  <p className="text-sm text-green-700 mt-1">File uploaded successfully!</p>
                  {uploadResult.url && (
                    <a 
                      href={uploadResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:text-purple-700 underline mt-2 inline-block"
                    >
                      View Uploaded File
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-700 mt-1">{uploadResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-600">
        <p className="font-medium mb-2">Troubleshooting Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Make sure the "persona-content" bucket exists in Supabase</li>
          <li>Verify RLS policies are set up correctly</li>
          <li>Check that you're logged in (authenticated)</li>
          <li>Try a small file first (under 1MB)</li>
          <li>Check browser console for detailed errors</li>
        </ul>
      </div>
    </div>
  );
}