import { supabase } from './supabase';
import { memoryExtractor } from './memoryExtraction';
import { captureException } from './monitoring';

const META_GRAPH_API_VERSION = 'v19.0';
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export interface MetaUserProfile {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

export interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  full_picture?: string;
  attachments?: {
    data: Array<{
      media?: {
        image?: {
          src: string;
        };
      };
      type: string;
      url?: string;
    }>;
  };
  likes?: {
    summary: {
      total_count: number;
    };
  };
  comments?: {
    summary: {
      total_count: number;
    };
  };
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
}

export interface MetaImportResult {
  success: boolean;
  platform: 'facebook' | 'instagram';
  postsImported: number;
  memoriesExtracted: number;
  error?: string;
}

export class MetaGraphAPIService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  async getUserProfile(): Promise<MetaUserProfile | null> {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }

    try {
      const response = await fetch(
        `${META_GRAPH_BASE_URL}/me?fields=id,name,email,picture&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      captureException(error as Error);
      return null;
    }
  }

  async getFacebookPosts(limit: number = 50): Promise<FacebookPost[]> {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }

    try {
      const fields = 'id,message,story,created_time,full_picture,attachments{media,type,url},likes.summary(true),comments.summary(true)';
      const response = await fetch(
        `${META_GRAPH_BASE_URL}/me/posts?fields=${fields}&limit=${limit}&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Facebook API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Facebook posts:', error);
      captureException(error as Error);
      throw error;
    }
  }

  async getFacebookPhotos(limit: number = 50): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }

    try {
      const fields = 'id,created_time,name,images,likes.summary(true)';
      const response = await fetch(
        `${META_GRAPH_BASE_URL}/me/photos?type=uploaded&fields=${fields}&limit=${limit}&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Facebook photos:', error);
      captureException(error as Error);
      return [];
    }
  }

  async getInstagramAccount(): Promise<{ id: string; username: string } | null> {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }

    try {
      const response = await fetch(
        `${META_GRAPH_BASE_URL}/me/accounts?access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const pageId = data.data[0].id;
        const pageAccessToken = data.data[0].access_token;

        const igResponse = await fetch(
          `${META_GRAPH_BASE_URL}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
        );

        const igData = await igResponse.json();

        if (igData.instagram_business_account) {
          return {
            id: igData.instagram_business_account.id,
            username: ''
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching Instagram account:', error);
      return null;
    }
  }

  async getInstagramMedia(limit: number = 50): Promise<InstagramMedia[]> {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }

    try {
      const igAccount = await this.getInstagramAccount();

      if (!igAccount) {
        console.warn('No Instagram Business account found');
        return [];
      }

      const fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url';
      const response = await fetch(
        `${META_GRAPH_BASE_URL}/${igAccount.id}/media?fields=${fields}&limit=${limit}&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram media:', error);
      captureException(error as Error);
      return [];
    }
  }

  async importFacebookContent(personaId: string, userId: string): Promise<MetaImportResult> {
    try {
      console.log('Starting Facebook content import...');

      const [posts, photos] = await Promise.all([
        this.getFacebookPosts(100),
        this.getFacebookPhotos(50)
      ]);

      let memoriesExtracted = 0;

      for (const post of posts) {
        const content = post.message || post.story || '';
        const mediaUrls: string[] = [];

        if (post.full_picture) {
          mediaUrls.push(post.full_picture);
        }

        if (post.attachments?.data) {
          post.attachments.data.forEach(attachment => {
            if (attachment.media?.image?.src) {
              mediaUrls.push(attachment.media.image.src);
            }
          });
        }

        await supabase.from('persona_content').insert({
          persona_id: personaId,
          content_type: 'text',
          file_name: `facebook_post_${post.id}`,
          metadata: {
            platform: 'facebook',
            post_id: post.id,
            content,
            media_urls: mediaUrls,
            created_time: post.created_time,
            likes: post.likes?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0
          },
          processing_status: 'pending'
        });

        if (content) {
          const memories = await memoryExtractor.extractFromText(content, personaId);

          memories.forEach(memory => {
            memory.source = 'social_media';
            memory.metadata = {
              ...memory.metadata,
              platform: 'facebook',
              post_id: post.id,
              timestamp: post.created_time
            };
          });

          await memoryExtractor.saveMemories(memories);
          memoriesExtracted += memories.length;
        }

        for (const imageUrl of mediaUrls) {
          try {
            const imageMemories = await memoryExtractor.extractFromImage(imageUrl, personaId);
            imageMemories.forEach(memory => {
              memory.source = 'social_media';
              memory.metadata = {
                ...memory.metadata,
                platform: 'facebook',
                post_id: post.id
              };
            });
            await memoryExtractor.saveMemories(imageMemories);
            memoriesExtracted += imageMemories.length;
          } catch (error) {
            console.warn('Failed to extract from image:', error);
          }
        }
      }

      await supabase.from('social_media_connections').upsert({
        user_id: userId,
        persona_id: personaId,
        platform: 'facebook',
        access_token: this.accessToken,
        last_sync: new Date().toISOString(),
        posts_imported: posts.length,
        status: 'active'
      });

      console.log(`Facebook import complete: ${posts.length} posts, ${memoriesExtracted} memories`);

      return {
        success: true,
        platform: 'facebook',
        postsImported: posts.length,
        memoriesExtracted
      };
    } catch (error) {
      console.error('Error importing Facebook content:', error);
      captureException(error as Error, { personaId, userId });

      return {
        success: false,
        platform: 'facebook',
        postsImported: 0,
        memoriesExtracted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async importInstagramContent(personaId: string, userId: string): Promise<MetaImportResult> {
    try {
      console.log('Starting Instagram content import...');

      const media = await this.getInstagramMedia(100);

      let memoriesExtracted = 0;

      for (const item of media) {
        await supabase.from('persona_content').insert({
          persona_id: personaId,
          content_type: item.media_type === 'VIDEO' ? 'video' : 'image',
          file_name: `instagram_${item.id}`,
          file_url: item.media_url,
          metadata: {
            platform: 'instagram',
            media_id: item.id,
            caption: item.caption,
            media_type: item.media_type,
            permalink: item.permalink,
            timestamp: item.timestamp,
            likes: item.like_count || 0,
            comments: item.comments_count || 0,
            thumbnail_url: item.thumbnail_url
          },
          processing_status: 'pending'
        });

        if (item.caption) {
          const memories = await memoryExtractor.extractFromText(item.caption, personaId);

          memories.forEach(memory => {
            memory.source = 'social_media';
            memory.metadata = {
              ...memory.metadata,
              platform: 'instagram',
              media_id: item.id,
              timestamp: item.timestamp
            };
          });

          await memoryExtractor.saveMemories(memories);
          memoriesExtracted += memories.length;
        }

        if (item.media_type === 'IMAGE' && item.media_url) {
          try {
            const imageMemories = await memoryExtractor.extractFromImage(
              item.media_url,
              personaId
            );

            imageMemories.forEach(memory => {
              memory.source = 'social_media';
              memory.metadata = {
                ...memory.metadata,
                platform: 'instagram',
                media_id: item.id
              };
            });

            await memoryExtractor.saveMemories(imageMemories);
            memoriesExtracted += imageMemories.length;
          } catch (error) {
            console.warn('Failed to extract from Instagram image:', error);
          }
        }
      }

      await supabase.from('social_media_connections').upsert({
        user_id: userId,
        persona_id: personaId,
        platform: 'instagram',
        access_token: this.accessToken,
        last_sync: new Date().toISOString(),
        posts_imported: media.length,
        status: 'active'
      });

      console.log(`Instagram import complete: ${media.length} posts, ${memoriesExtracted} memories`);

      return {
        success: true,
        platform: 'instagram',
        postsImported: media.length,
        memoriesExtracted
      };
    } catch (error) {
      console.error('Error importing Instagram content:', error);
      captureException(error as Error, { personaId, userId });

      return {
        success: false,
        platform: 'instagram',
        postsImported: 0,
        memoriesExtracted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    try {
      const appId = import.meta.env.VITE_META_APP_ID;
      const appSecret = import.meta.env.VITE_META_APP_SECRET;

      if (!appId || !appSecret) {
        throw new Error('Meta App ID or Secret not configured');
      }

      const response = await fetch(
        `${META_GRAPH_BASE_URL}/oauth/access_token?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${appSecret}&` +
        `code=${code}`
      );

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const data = await response.json();

      if (data.access_token) {
        this.setAccessToken(data.access_token);
        return data.access_token;
      }

      throw new Error('No access token in response');
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      captureException(error as Error);
      throw error;
    }
  }

  async getLongLivedToken(shortToken: string): Promise<string> {
    try {
      const appId = import.meta.env.VITE_META_APP_ID;
      const appSecret = import.meta.env.VITE_META_APP_SECRET;

      const response = await fetch(
        `${META_GRAPH_BASE_URL}/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${shortToken}`
      );

      if (!response.ok) {
        throw new Error('Long-lived token exchange failed');
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting long-lived token:', error);
      return shortToken;
    }
  }
}

export const metaGraphAPI = new MetaGraphAPIService();
