import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEOHead({
  title = 'AlwayZ - Keep Their Memory Alive',
  description = 'Create AI personas of loved ones using their voice, mannerisms, and memories. Have meaningful conversations that help you through the grieving process.',
  keywords = 'AI, personas, grief support, memory preservation, voice synthesis, conversations, healing',
  image = '/og-image.png',
  url = 'https://alwayz.app',
  type = 'website'
}: SEOHeadProps) {
  const fullTitle = title.includes('AlwayZ') ? title : `${title} | AlwayZ`;
  const fullUrl = url.startsWith('http') ? url : `https://alwayz.app${url}`;
  const fullImage = image.startsWith('http') ? image : `https://alwayz.app${image}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="AlwayZ" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph Meta Tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content="AlwayZ" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:site" content="@AlwayzApp" />

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#8B5CF6" />
      <meta name="msapplication-TileColor" content="#8B5CF6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="AlwayZ" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "AlwayZ",
          "description": description,
          "url": "https://alwayz.app",
          "applicationCategory": "LifestyleApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "author": {
            "@type": "Organization",
            "name": "AlwayZ"
          }
        })}
      </script>
    </Helmet>
  );
}