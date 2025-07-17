import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { exchangeCodeForToken } from '../utils/socialMediaAPI';

interface OAuthCallbackProps {
  onSuccess: (platform: string, accessToken: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function OAuthCallback({ onSuccess, onError, onCancel }: OAuthCallbackProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const processOAuthCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state'); // This contains the platform name
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`OAuth error: ${error}`);
        onError(`OAuth error: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or platform information');
        onError('Missing authorization code or platform information');
        return;
      }

      try {
        setMessage(`Exchanging authorization code for ${state} access token...`);
        
        // Exchange code for access token
        const accessToken = await exchangeCodeForToken(
          state, 
          code, 
          window.location.origin + '/oauth/callback'
        );

        setStatus('success');
        setMessage(`Successfully connected to ${state}!`);
        onSuccess(state, accessToken);
      } catch (error) {
        setStatus('error');
        setMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        onError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    processOAuthCallback();
  }, [searchParams, onSuccess, onError]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Successful!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={onCancel}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              Continue
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}