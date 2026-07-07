import { useEffect, useRef, useState } from 'react';

const postStats = async (slug, action) => {
  const res = await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, action }),
  });
  if (!res.ok) throw new Error(`stats ${action} failed: ${res.status}`);
};

const readLikedFromStorage = (slug) => {
  if (!slug || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`liked:${slug}`) === 'true';
};

export const usePostStats = (slug) => {
  const [hasLiked, setHasLiked] = useState(() => readLikedFromStorage(slug));
  const viewRegistered = useRef(false);

  useEffect(() => {
    if (!slug) return;
    
    const viewedKey = `viewed:${slug}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(viewedKey) === 'true') {
      return;
    }

    if (viewRegistered.current) return;
    viewRegistered.current = true;

    postStats(slug, 'view')
      .then(() => {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(viewedKey, 'true');
        }
      })
      .catch((err) => {
        console.error('Failed to register view:', err);
      });
  }, [slug]);

  const like = async () => {
    if (!slug || hasLiked) return;

    setHasLiked(true);
    localStorage.setItem(`liked:${slug}`, 'true');

    try {
      await postStats(slug, 'like');
    } catch (err) {
      console.error('Failed to register like:', err);
      setHasLiked(false);
      localStorage.removeItem(`liked:${slug}`);
    }
  };

  return { hasLiked, like };
};
