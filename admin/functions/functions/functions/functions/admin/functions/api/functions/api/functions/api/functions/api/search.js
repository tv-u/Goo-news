// Search API - Search across current + archived news
export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60'
  };

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();
  const limit = parseInt(url.searchParams.get('limit')) || 20;

  if (!query) {
    return new Response(JSON.stringify({ status: 'success', query: '', results: [], total: 0 }), { headers });
  }

  try {
    let results = [];

    // Search current cache
    const country = request.headers.get('CF-IPCountry') || 'US';
    const lang = request.headers.get('X-Language') || 'en';
    const cacheKey = `news_v2_${country}_${lang}_all`;

    const cached = await env.NEWS_KV?.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      const matches = data.articles?.filter(a =>
        a.title.toLowerCase().includes(query) ||
        (a.description || '').toLowerCase().includes(query) ||
        (a.category || '').toLowerCase().includes(query) ||
        (a.source || '').toLowerCase().includes(query)
      ) || [];
      results.push(...matches);
    }

    // Search archive (last 7 days)
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const indexKey = `archive:index:${dStr}`;
      const indexData = await env.NEWS_KV?.get(indexKey);

      if (indexData) {
        const slugs = JSON.parse(indexData);
        const articles = await Promise.all(
          slugs.map(slug => env.NEWS_KV.get(`archive:${dStr}:${slug}`))
        );
        const matches = articles
          .filter(a => a)
          .map(a => JSON.parse(a))
          .filter(a =>
            a.title.toLowerCase().includes(query) ||
            (a.description || '').toLowerCase().includes(query)
          );
        results.push(...matches);
      }
    }

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const r of results) {
      if (!seen.has(r.slug)) { seen.add(r.slug); unique.push(r); }
    }

    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const final = unique.slice(0, limit);

    return new Response(JSON.stringify({
      status: 'success',
      query,
      total: final.length,
      results: final
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', message: error.message, results: [] }), { status: 500, headers });
  }
}
