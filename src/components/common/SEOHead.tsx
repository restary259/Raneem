import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  /** Absolute or root-relative URL of the current page. Defaults to the live location. */
  url?: string;
  /** Absolute URL of the social preview image. */
  image?: string;
  /** Optional JSON-LD structured data for this page. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Keep this route out of search indexes (utility/private pages). */
  noindex?: boolean;
}

const DEFAULT_TITLE = 'درب | الدراسة في ألمانيا للطلاب العرب';

/**
 * Canonical/og URLs are always built on the brand domain. Using
 * window.location.origin would publish preview/sandbox hosts (e.g. *.lovable.app)
 * as canonical, which is what caused the wrong domain to be indexed.
 */
const CANONICAL_ORIGIN = 'https://darb.agency';
const SITE_NAME = 'درب التعليمية';
const TWITTER_SITE = '@darb_education';

/** Force any incoming URL onto the brand domain, keeping only the path. */
const toCanonical = (value: string) => {
  try {
    const path = new URL(value, CANONICAL_ORIGIN).pathname.replace(/\/+$/, '');
    return path ? `${CANONICAL_ORIGIN}${path}` : `${CANONICAL_ORIGIN}/`;
  } catch {
    return `${CANONICAL_ORIGIN}/`;
  }
};


const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const SEOHead = ({ title, description, url, image, jsonLd, noindex }: SEOHeadProps) => {
  useEffect(() => {
    const source =
      url ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const pageUrl = toCanonical(source);

    document.title = title;
    setMeta('name', 'description', description);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', pageUrl);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:locale', document.documentElement.lang === 'en' ? 'en_US' : 'ar_AR');

    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:site', TWITTER_SITE);

    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }

    setLink('canonical', pageUrl);

    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      setMeta('name', 'robots', 'noindex, nofollow');
    } else if (robots) {
      robots.remove();
    }

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-page-jsonld', 'true');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      script?.remove();
    };
  }, [title, description, url, image, jsonLd, noindex]);

  return null;
};

export default SEOHead;
