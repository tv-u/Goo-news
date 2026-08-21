// Archive API - Retrieve news from last 30 days
export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300'
  };

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  const lang = url.searchParams.get('lang') || 'en';

  try {
    if (!env.NEWS_KV) {
      return new Response(JSON.stringify({ status: 'success', articles: [], total: 0 }), { headers });
    }

    let articles = [];

    if (date) {
      // Get specific date
      const indexKey = `archive:index:${date}`;
      const indexData = await env.NEWS_KV.get(indexKey);
      if (indexData) {
        const slugs = JSON.parse(indexData);
        const results = await Promise.all(
          slugs.map(slug => env.NEWS_KV.get(`archive:${date}:${slug}`))
        );
        articles = results.filter(r => r).map(r => JSON.parse(r));
      }
    } else {
      // Get last 7 days
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      for (const dt of dates) {
        const indexKey = `archive:index:${dt}`;
        const indexData = await env.NEWS_KV.get(indexKey);
        if (indexData) {
          const slugs = JSON.parse(indexData).slice(0, Math.ceil(limit / dates.length));
          const results = await Promise.all(
            slugs.map(slug => env.NEWS_KV.get(`archive:${dt}:${slug}`))
          );
          articles.push(...results.filter(r => r).map(r => JSON.parse(r)));
        }
      }
    }

    // Sort by date desc
    articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    articles = articles.slice(0, limit);

    return new Response(JSON.stringify({
      status: 'success',
      total: articles.length,
      date: date || 'last-7-days',
      articles
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', message: error.message, articles: [] }), { status: 500, headers });
  }
}
