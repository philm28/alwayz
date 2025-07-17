import { supabase } from './supabase';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: template
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    
    const template: EmailTemplate = {
      to: userEmail,
      subject: 'Welcome to AlwayZ - Keep Their Memory Alive',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to AlwayZ</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B5CF6; margin-bottom: 10px;">Welcome to AlwayZ</h1>
            <p style="color: #666; font-size: 18px;">Keep Their Memory Alive</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${userName},</h2>
            <p>Thank you for joining AlwayZ. We're honored to help you create meaningful connections with the memories of your loved ones.</p>
            
            <h3 style="color: #8B5CF6; margin-top: 25px;">Getting Started:</h3>
            <ul style="padding-left: 20px;">
              <li>Create your first AI persona</li>
              <li>Upload photos, videos, and voice recordings</li>
              <li>Train the AI with their personality and memories</li>
              <li>Start having meaningful conversations</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${appUrl}/dashboard" 
               style="background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Create Your First Persona
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>Need help? Reply to this email or visit our <a href="${appUrl}/support" style="color: #8B5CF6;">support center</a>.</p>
            <p>© 2024 AlwayZ. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to AlwayZ, ${userName}! Thank you for joining us. Visit ${appUrl}/dashboard to create your first AI persona.`
    };

    return this.sendEmail(template);
  }

  async sendPersonaReadyEmail(userEmail: string, personaName: string): Promise<boolean> {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    
    const template: EmailTemplate = {
      to: userEmail,
      subject: `${personaName} is ready for conversations!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B5CF6;">🎉 ${personaName} is Ready!</h1>
          </div>
          
          <div style="background: #f0f9ff; padding: 30px; border-radius: 10px; border-left: 4px solid #8B5CF6;">
            <p>Great news! Your AI persona <strong>${personaName}</strong> has finished training and is now ready for conversations.</p>
            
            <p>The AI has learned from the content you provided and can now:</p>
            <ul>
              <li>Respond in their unique voice and style</li>
              <li>Reference shared memories and experiences</li>
              <li>Provide comfort and meaningful conversations</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/dashboard" 
               style="background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Start Conversation with ${personaName}
            </a>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(template);
  }

  async sendSubscriptionConfirmationEmail(userEmail: string, planName: string): Promise<boolean> {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    
    const template: EmailTemplate = {
      to: userEmail,
      subject: `Welcome to AlwayZ ${planName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B5CF6;">Welcome to AlwayZ ${planName}!</h1>
          </div>
          
          <div style="background: #f0f9ff; padding: 30px; border-radius: 10px;">
            <p>Thank you for upgrading to AlwayZ ${planName}. You now have access to premium features:</p>
            
            ${planName === 'Pro' ? `
              <ul>
                <li>5 AI Personas</li>
                <li>Unlimited conversations</li>
                <li>Premium voice synthesis</li>
                <li>Video calls</li>
                <li>Social media import</li>
                <li>Priority support</li>
              </ul>
            ` : `
              <ul>
                <li>Unlimited AI Personas</li>
                <li>Unlimited conversations</li>
                <li>Custom voice cloning</li>
                <li>Advanced video calls</li>
                <li>API access</li>
                <li>White-label options</li>
                <li>Dedicated support</li>
              </ul>
            `}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/dashboard" 
               style="background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Explore Premium Features
            </a>
          </div>
        </body>
        </html>
      `
    };

    return this.sendEmail(template);
  }
}

export const emailService = EmailService.getInstance();