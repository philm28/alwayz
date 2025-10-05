import { supabase } from '../lib/supabase';
import { memoryExtractor } from '../lib/memoryExtraction';

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
  memoriesExtracted?: number;
}

export interface SocialMediaPost {
  id: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  timestamp: string;
  likes?: number;
  comments?: number;
  metadata?: any;
}

export async function initiateSocialMediaScraping(config: SocialMediaConfig): Promise<ScrapingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('social-media-scraper', {
      body: config
    });

    if (error) {
      throw error;
    }

    if (data && data.success && data.content) {
      await processScrapedContent(config.personaId, data.content, config.platform);

      const memoriesExtracted = await extractMemoriesFromSocialMedia(
        config.personaId,
        data.content
      );

      return {
        ...data,
        memoriesExtracted
      };
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

async function processScrapedContent(
  personaId: string,
  posts: SocialMediaPost[],
  platform: string
): Promise<void> {
  try {
    for (const post of posts) {
      await supabase.from('persona_content').insert({
        persona_id: personaId,
        content_type: 'text',
        file_name: `${platform}_post_${post.id}`,
        file_url: null,
        metadata: {
          platform,
          post_id: post.id,
          content: post.content,
          media_urls: post.mediaUrls,
          timestamp: post.timestamp,
          engagement: {
            likes: post.likes,
            comments: post.comments
          },
          raw_data: post.metadata
        },
        processing_status: 'pending'
      });
    }

    console.log(`Saved ${posts.length} social media posts for processing`);
  } catch (error) {
    console.error('Error processing scraped content:', error);
  }
}

async function extractMemoriesFromSocialMedia(
  personaId: string,
  posts: SocialMediaPost[]
): Promise<number> {
  let totalMemories = 0;

  try {
    for (const post of posts) {
      if (post.content) {
        const memories = await memoryExtractor.extractFromText(
          post.content,
          personaId
        );

        memories.forEach(memory => {
          memory.source = 'social_media';
          memory.metadata = {
            ...memory.metadata,
            platform: post.platform,
            post_id: post.id,
            timestamp: post.timestamp
          };
        });

        await memoryExtractor.saveMemories(memories);
        totalMemories += memories.length;
      }

      for (const imageUrl of post.mediaUrls) {
        if (imageUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
          try {
            const memories = await memoryExtractor.extractFromImage(
              imageUrl,
              personaId
            );

            memories.forEach(memory => {
              memory.source = 'social_media';
              memory.metadata = {
                ...memory.metadata,
                platform: post.platform,
                post_id: post.id
              };
            });

            await memoryExtractor.saveMemories(memories);
            totalMemories += memories.length;
          } catch (error) {
            console.warn('Failed to extract from image:', imageUrl, error);
          }
        }
      }
    }

    console.log(`Extracted ${totalMemories} memories from social media`);
  } catch (error) {
    console.error('Error extracting memories from social media:', error);
  }

  return totalMemories;
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