import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { absoluteUrl, getRouteMetadata } from '../siteMetadata';

const setMetaContent = (selector, content) => {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute('content', content);
};

const RouteMetadata = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getRouteMetadata(pathname);
    const canonicalUrl = absoluteUrl(metadata.path);
    const imageUrl = absoluteUrl(metadata.image);

    document.title = metadata.title;
    setMetaContent('meta[name="description"]', metadata.description);
    setMetaContent('meta[property="og:title"]', metadata.title);
    setMetaContent('meta[property="og:description"]', metadata.description);
    setMetaContent('meta[property="og:type"]', metadata.type);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:image"]', imageUrl);
    setMetaContent('meta[property="og:image:alt"]', metadata.imageAlt);
    setMetaContent('meta[name="twitter:card"]', metadata.twitterCard);
    setMetaContent('meta[name="twitter:title"]', metadata.title);
    setMetaContent('meta[name="twitter:description"]', metadata.description);
    setMetaContent('meta[name="twitter:image"]', imageUrl);
    setMetaContent('meta[name="twitter:image:alt"]', metadata.imageAlt);

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', canonicalUrl);
  }, [pathname]);

  return null;
};

export default RouteMetadata;
