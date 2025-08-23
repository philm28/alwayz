import { supabase } from '../lib/supabase';

export interface SocialMediaConfig {
  platform: string;
  accessToken?: string;
  profileUrl?: string;
  personaId: string;
}

export interface ScrapingResult {
  success: boolean;
  itemsScraped: number;
  content?: any[];
  error?: string;
}

export async function initiateSocialMediaScraping(config: SocialMediaConfig): Promise<ScrapingResult> {
  try {
    // Call the Supabase Edge Function for social media scraping
    const { data, error } = await supabase.functions.invoke('social-media-scraper', {
      body: config
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Social media scraping error:', error);
    return {
      success: false,
      itemsScraped: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export function getOAuthUrl(platform: string, redirectUri: string): string {
  const baseUrls = {
    facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    instagram: 'https://api.instagram.com/oauth/authorize',
    twitter: 'https://twitter.com/i/oauth2/authorize',
    linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
    youtube: 'https://accounts.google.com/o/oauth2/v2/auth'
  };

  const clientIds = {
    facebook: import.meta.env.VITE_FACEBOOK_CLIENT_ID,
    instagram: import.meta.env.VITE_INSTAGRAM_CLIENT_ID,
    twitter: import.meta.env.VITE_TWITTER_CLIENT_ID,
    linkedin: import.meta.env.VITE_LINKEDIN_CLIENT_ID,
    youtube: import.meta.env.VITE_GOOGLE_CLIENT_ID
  };

  const scopes = {
    facebook: 'public_profile,user_posts,user_photos',
    instagram: 'user_profile,user_media',
    twitter: 'tweet.read,users.read',
    linkedin: 'r_liteprofile,r_emailaddress,w_member_social',
    youtube: 'https://www.googleapis.com/auth/youtube.readonly'
  };

  const baseUrl = baseUrls[platform as keyof typeof baseUrls];
  const clientId = clientIds[platform as keyof typeof clientIds];
  const scope = scopes[platform as keyof typeof scopes];

  if (!baseUrl || !clientId) {
    throw new Error(`OAuth not configured for ${platform}. Please add VITE_${platform.toUpperCase()}_CLIENT_ID to your environment variables.`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scope,
    response_type: 'code',
    state: platform // Use platform as state for identification
  });

  return `${baseUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(platform: string, code: string, redirectUri: string): Promise<string> {
  // This would typically be handled by a backend service for security
  // For demo purposes, we'll simulate the token exchange
  
  console.log(`Exchanging code for ${platform} access token...`);
  
  // In production, this would make a secure server-side request to exchange the code
  // for an access token using the client secret
  
  // Simulate token exchange delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock access token
  return `mock_access_token_${platform}_${Date.now()}`;
}

export function validateSocialMediaUrl(platform: string, url: string): boolean {
  const patterns = {
    facebook: /^https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]+\/?$/,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/,
    twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/,
    linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/[a-zA-Z0-9-]+\/?$/,
    youtube: /^https?:\/\/(www\.)?youtube\.com\/(channel\/|user\/|c\/)[a-zA-Z0-9_-]+\/?$/,
    website: /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/?.*$/
  };

  const pattern = patterns[platform as keyof typeof patterns];
  return pattern ? pattern.test(url) : false;
}