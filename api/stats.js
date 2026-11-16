export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fallback helper for local development if keys are not set yet
  const hasDb = !!(url && token);

  const fetchRedis = async (commands) => {
    if (!hasDb) {
      console.warn("Upstash Redis environment variables are missing. Using mock response.");
      return null;
    }
    
    // Commands can be a single command array [cmd, key] or a pipeline array of arrays [[cmd, key], ...]
    const isPipeline = Array.isArray(commands[0]);
    const endpoint = isPipeline ? `${url}/pipeline` : `${url}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Upstash API error: ${response.statusText}`);
    }

    return response.json();
  };

  try {
    if (req.method === 'GET') {
      const { slug, slugs } = req.query;

      // Handle bulk fetch for multiple slugs (e.g. for post list page)
      if (slugs) {
        const slugList = slugs.split(',');
        if (!hasDb) {
          // Mock response for local dev
          const mockData = {};
          slugList.forEach(s => {
            mockData[s] = { views: 2410, likes: 189 };
          });
          return res.status(200).json(mockData);
        }

        // Pipeline queries to get views and likes for all requested slugs
        const pipeline = [];
        slugList.forEach(s => {
          pipeline.push(['GET', `post:${s}:views`]);
          pipeline.push(['GET', `post:${s}:likes`]);
        });

        const results = await fetchRedis(pipeline);
        
        const data = {};
        slugList.forEach((s, index) => {
          const viewsRes = results[index * 2];
          const likesRes = results[index * 2 + 1];
          
          data[s] = {
            views: parseInt(viewsRes?.result || '0', 10),
            likes: parseInt(likesRes?.result || '0', 10),
          };
        });

        return res.status(200).json(data);
      }

      // Handle single slug fetch
      if (!slug) {
        return res.status(400).json({ error: 'Missing slug or slugs parameter' });
      }

      if (!hasDb) {
        return res.status(200).json({ views: 2410, likes: 189 });
      }

      const pipeline = [
        ['GET', `post:${slug}:views`],
        ['GET', `post:${slug}:likes`],
      ];
      const results = await fetchRedis(pipeline);
      
      const views = parseInt(results[0]?.result || '0', 10);
      const likes = parseInt(results[1]?.result || '0', 10);

      return res.status(200).json({ views, likes });
    }

    if (req.method === 'POST') {
      const { slug, action } = req.body || {};

      if (!slug || !action) {
        return res.status(400).json({ error: 'Missing slug or action parameter' });
      }

      if (action !== 'view' && action !== 'like') {
        return res.status(400).json({ error: 'Invalid action. Must be "view" or "like"' });
      }

      if (!hasDb) {
        // Mock success response for local dev
        return res.status(200).json({ 
          views: action === 'view' ? 2411 : 2410, 
          likes: action === 'like' ? 190 : 189 
        });
      }

      const key = `post:${slug}:${action === 'view' ? 'views' : 'likes'}`;
      
      // Increment the value in Redis and then get both views and likes
      const pipeline = [
        ['INCR', key],
        ['GET', `post:${slug}:views`],
        ['GET', `post:${slug}:likes`],
      ];
      
      const results = await fetchRedis(pipeline);
      
      // The results from pipeline: 
      // results[0] = INCR response
      // results[1] = GET views response
      // results[2] = GET likes response
      const views = parseInt(results[1]?.result || '0', 10);
      const likes = parseInt(results[2]?.result || '0', 10);

      return res.status(200).json({ views, likes });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Request error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
