// Enhanced Dynamic XML Sitemap with hreflang support
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const country = request.headers.get('CF-IPCountry') || 'US';
  const lang = request.headers.get('X-Language') || 'en';

  let articles = [];

  // Get current articles
  try {
    const cacheKey = `news_v2_${country}_${lang}_all`;
    const cached = await env.NEWS_KV?.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      articles = data.articles || [];
    }
  } catch (e) {}

  // Fallback to English
  if (!articles.length) {
    try {
      const cached = await env.NEWS_KV?.get(`news_v2_${country}_en_all`);
      if (cached) {
        const data = JSON.parse(cached);
        articles = data.articles || [];
      }
    } catch (e) {}
  }

  const now = new Date().toISOString();
  const languages = ['en', 'hi', 'nl', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'pt', 'ru'];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>always</changefreq>
    <priority>1.0</priority>`;

  // hreflang for home
  for (const l of languages) {
    xml += `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${origin}/?lang=${l}" />`;
  }
  xml += `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/" />`;
  xml += `\n  </url>`;

  // Category pages
  const categories = ['World', 'Technology', 'Politics', 'Science', 'Sports', 'Finance', 'Entertainment', 'Health'];
  for (const cat of categories) {
    xml += `\n  <url>\n    <loc>${origin}/?cat=${cat}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.9</priority>\n  </url>`;
  }

  // Article URLs
  for (const article of articles.slice(0, 100)) {
    xml += `\n  <url>\n    <loc>${origin}/article/${article.slug}</loc>\n    <lastmod>${article.pubDate || now}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.8</priority>`;
    for (const l of languages) {
      xml += `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${origin}/article/${article.slug}?lang=${l}" />`;
    }
    xml += `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/article/${article.slug}" />`;
    xml += `\n  </url>`;
  }

  xml += '\n</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
