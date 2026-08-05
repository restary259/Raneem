import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  /** Absolute or root-relative URL of the current page. Defaults to the live location. */
  url?: string;
  /** Absolute URL of the social preview image. */
  image?: string;
}

const DEFAULT_TITLE = 'درب | رفيقك الدراسي العالمي';

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

const SEOHead = ({ title, description, url, image }: SEOHeadProps) => {
  useEffect(() => {
    const pageUrl =
      url ?? (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '/');

    document.title = title;
    setMeta('name', 'description', description);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', pageUrl);
    setMeta('property', 'og:type', 'website');

    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }

    setLink('canonical', pageUrl);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, url, image]);

  return null;
};

export default SEOHead;
