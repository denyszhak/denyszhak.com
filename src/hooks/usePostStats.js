import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

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

const likedChangeEvent = (slug) => `liked:${slug}:change`;

const updateLikedStorage = (slug, liked) => {
  const key = `liked:${slug}`;
  if (liked) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(likedChangeEvent(slug)));
};

export const usePostStats = (slug) => {
  const viewRegistered = useRef(false);
  const subscribeToLikedState = useCallback((callback) => {
    const handleStorage = (event) => {
      if (event.key === `liked:${slug}`) callback();
    };

    window.addEventListener(likedChangeEvent(slug), callback);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(likedChangeEvent(slug), callback);
      window.removeEventListener('storage', handleStorage);
    };
  }, [slug]);
  const readLiked = useCallback(() => readLikedFromStorage(slug), [slug]);
  const hasLiked = useSyncExternalStore(subscribeToLikedState, readLiked, () => false);

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

    updateLikedStorage(slug, true);

    try {
      await postStats(slug, 'like');
    } catch (err) {
      console.error('Failed to register like:', err);
      updateLikedStorage(slug, false);
    }
  };

  return { hasLiked, like };
};
