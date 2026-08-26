export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cacheKey = `cache:${url.pathname}`;

    try {
      if (env.MY_KV) {
        const cachedData = await env.MY_KV.get(cacheKey);
        if (cachedData && url.pathname.startsWith('/api/')) {
          return new Response(cachedData, {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Status': 'HIT-KV',
              'X-Frame-Options': 'SAMEORIGIN'
            }
          });
        }
      }

      const response = await env.ASSETS.fetch(request);
      const newResponse = new Response(response.body, response);
      
      // Security & Adsterra Proxy Headers
      newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
      newResponse.headers.set('X-Content-Type-Options', 'nosniff');
      newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      newResponse.headers.set('X-Cloudflare-Worker', 'Active-Monetization-v9');

      return newResponse;
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
