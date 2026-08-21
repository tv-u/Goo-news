// RSS Feed Generator - For news aggregators
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const country = request.headers.get('CF-IPCountry') || 'US';
  const lang = request.headers.get('X-Language') || 'en';

  let articles = [];

  try {
    const cacheKey = `news_v2_${country}_${lang}_all`;
    const cached = await env.NEWS_KV?.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      articles = data.articles || [];
    }
  } catch (e) {}

  const now = new Date().toUTCString();

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>ViralNews Pro - Trending News</title>
  <link>${origin}/</link>
  <description>Real-time viral news from around the world. Auto-updating trending headlines.</description>
  <language>${lang}</language>
  <lastBuildDate>${now}</lastBuildDate>
  <atom:link href="${origin}/rss" rel="self" type="application/rss+xml" />
  <image>
    <url>${origin}/logo.png</url>
    <title>ViralNews Pro</title>
    <link>${origin}/</link>
  </image>`;

  for (const article of articles.slice(0, 30)) {
    const pubDate = new Date(article.pubDate).toUTCString();
    rss += `
  <item>
    <title>${escXml(article.title)}</title>
    <link>${origin}/article/${article.slug}</link>
    <guid isPermaLink="true">${origin}/article/${article.slug}</guid>
    <pubDate>${pubDate}</pubDate>
    <category>${escXml(article.category || 'World')}</category>
    <description>${escXml(article.description || article.title)}</description>
    ${article.image ? `<enclosure url="${article.image}" type="image/jpeg" />` : ''}
    <source url="${escXml(article.url || '')}">${escXml(article.source)}</source>
  </item>`;
  }

  rss += '\n  </channel>\n</rss>';

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

function escXml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, ''');
}
