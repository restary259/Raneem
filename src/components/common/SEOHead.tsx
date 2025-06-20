
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  articleAuthor?: string;
  articlePublishedTime?: string;
  articleSection?: string;
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = "درب للدراسة الدولية - بوابتك للدراسة في الخارج",
  description = "درب هي شركتك الموثوقة للدراسة في الخارج. نقدم خدمات شاملة من اختيار الجامعة إلى الحصول على التأشيرة والاستقرار في بلد الدراسة.",
  keywords = "دراسة في الخارج، جامعات ألمانيا، تأشيرة دراسية، منح دراسية، درب، تعليم دولي",
  image = "/placeholder.svg?height=630&width=1200",
  url = "https://darb-education.com",
  type = "website",
  articleAuthor,
  articlePublishedTime,
  articleSection
}) => {
  const siteName = "درب للدراسة الدولية";
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="درب للدراسة الدولية" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="Arabic" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="ar_SA" />
      
      {/* Twitter Card */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Article specific meta tags */}
      {type === 'article' && (
        <>
          {articleAuthor && <meta property="article:author" content={articleAuthor} />}
          {articlePublishedTime && <meta property="article:published_time" content={articlePublishedTime} />}
          {articleSection && <meta property="article:section" content={articleSection} />}
          <meta property="article:publisher" content={siteName} />
        </>
      )}
      
      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": siteName,
          "description": description,
          "url": url,
          "logo": `${url}/logo.png`,
          "sameAs": [
            "https://facebook.com/darb-education",
            "https://instagram.com/darb_education",
            "https://tiktok.com/@darb_education"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+972529402168",
            "contactType": "customer service",
            "availableLanguage": ["Arabic", "English", "German"]
          }
        })}
      </script>
      
      {/* Structured Data - Educational Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "name": siteName,
          "description": "شركة متخصصة في خدمات الدراسة في الخارج",
          "url": url,
          "areaServed": ["Middle East", "Arab World"],
          "serviceType": "Educational Consulting"
        })}
      </script>
    </Helmet>
  );
};

export default SEOHead;
