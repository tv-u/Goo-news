// Enhanced Article Detail Page - Server-Side Rendered for SEO
// Features: Structured data, OG tags, Twitter cards, related articles

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.pathname.replace('/article/', '').replace(/\/$/, '');

  const country = request.headers.get('CF-IPCountry') || 'US';
  const lang = request.headers.get('X-Language') || 'en';
  const city = request.headers.get('X-City') || '';

  // Find article from current cache or archive
  let article = null;
  let relatedArticles = [];

  // Try current cache first
  try {
    const cacheKey = `news_v2_${country}_${lang}_all`;
    const cached = await env.NEWS_KV?.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      article = data.articles?.find(a => a.slug === slug);
      if (data.articles) {
        relatedArticles = data.articles.filter(a => a.slug !== slug).slice(0, 4);
      }
    }
  } catch (e) {}

  // Try English cache
  if (!article) {
    try {
      const cached = await env.NEWS_KV?.get(`news_v2_${country}_en_all`);
      if (cached) {
        const data = JSON.parse(cached);
        article = data.articles?.find(a => a.slug === slug);
        if (data.articles) {
          relatedArticles = data.articles.filter(a => a.slug !== slug).slice(0, 4);
        }
      }
    } catch (e) {}
  }

  // Try archive (last 7 days)
  if (!article) {
    try {
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const archived = await env.NEWS_KV?.get(`archive:${dateStr}:${slug}`);
        if (archived) {
          article = JSON.parse(archived);
          break;
        }
      }
    } catch (e) {}
  }

  // If not found, redirect to home
  if (!article) {
    return Response.redirect(url.origin + '/', 302);
  }

  // Generate SEO HTML
  const title = article.title + ' | ViralNews Pro';
  const description = (article.description || article.title).slice(0, 160);
  const keywords = `${article.category}, viral news, trending, ${article.source}, breaking news, ${article.title.split(' ').slice(0, 5).join(', ')}`;
  const canonical = `${url.origin}/article/${slug}`;
  const image = article.image || `${url.origin}/og-image.jpg`;
  const timeAgo = getTimeAgo(article.pubDate);
  const pubDate = new Date(article.pubDate).toISOString();

  // Related articles HTML
  const relatedHtml = relatedArticles.map(a => `
    <a href="/article/${a.slug}" class="related-card">
      <img src="${a.image || 'https://via.placeholder.com/300x180/1a1a2e/ffffff?text=News'}" alt="${esc(a.title)}">
      <div class="related-title">${esc(a.title)}</div>
      <div class="related-meta">${esc(a.source)} • ${getTimeAgo(a.pubDate)}</div>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc(keywords)}">
  <meta name="author" content="ViralNews Pro">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="news_keywords" content="${esc(keywords)}">
  <link rel="canonical" href="${canonical}">
  <link rel="amphtml" href="${canonical}?amp=1">
  <!-- Open Graph -->
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="ViralNews Pro">
  <meta property="og:locale" content="${lang}_${country}">
  <meta property="article:published_time" content="${pubDate}">
  <meta property="article:modified_time" content="${pubDate}">
  <meta property="article:section" content="${article.category}">
  <meta property="article:tag" content="${esc(article.category)}">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:site" content="@viralnewspro">
  <!-- Structured Data: NewsArticle -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "${esc(article.title)}",
    "description": "${esc(description)}",
    "image": ["${image}"],
    "datePublished": "${pubDate}",
    "dateModified": "${pubDate}",
    "author": {"@type": "Organization", "name": "ViralNews Pro", "url": "${url.origin}"},
    "publisher": {"@type": "Organization", "name": "ViralNews Pro", "logo": {"@type": "ImageObject", "url": "${url.origin}/logo.png"}},
    "mainEntityOfPage": {"@type": "WebPage", "@id": "${canonical}"},
    "articleSection": "${article.category}",
    "keywords": "${esc(keywords)}"
  }
  </script>
  <!-- Structured Data: BreadcrumbList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Home", "item": "${url.origin}/"},
      {"@type": "ListItem", "position": 2, "name": "${article.category}", "item": "${url.origin}/?cat=${article.category}"},
      {"@type": "ListItem", "position": 3, "name": "${esc(article.title)}", "item": "${canonical}"}
    ]
  }
  </script>
  <!-- hreflang for multilingual SEO -->
  <link rel="alternate" hreflang="en" href="${url.origin}/article/${slug}?lang=en">
  <link rel="alternate" hreflang="hi" href="${url.origin}/article/${slug}?lang=hi">
  <link rel="alternate" hreflang="nl" href="${url.origin}/article/${slug}?lang=nl">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
  <style>
    :root {
      --bg-deep: #050508; --bg-card: rgba(15,15,25,0.9); --text: #f0f0f5;
      --text-muted: #8892a0; --accent: #ff4757; --accent2: #2ed573;
      --accent3: #1e90ff; --border: rgba(255,255,255,0.08); --radius: 20px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg-deep); color: var(--text); line-height: 1.6; }
    header { background: rgba(5,5,8,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 1rem 2rem; }
    .header-inner { max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 1.4rem; font-weight: 900; text-decoration: none; color: var(--text); }
    .logo span { color: var(--accent); }
    .back-btn { color: var(--text-muted); text-decoration: none; font-size: 0.875rem; transition: 0.2s; }
    .back-btn:hover { color: var(--accent); }

    main { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .article-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .article-badge { background: var(--accent); color: #fff; padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .article-source { color: var(--text-muted); font-size: 0.875rem; }
    .article-time { color: var(--text-muted); font-size: 0.875rem; }
    .translated-badge { color: var(--accent2); font-size: 0.8rem; font-weight: 600; }

    .article-image { width: 100%; height: 450px; object-fit: cover; border-radius: var(--radius); margin-bottom: 2rem; border: 1px solid var(--border); }
    .article-title { font-size: 2.2rem; font-weight: 800; line-height: 1.2; margin-bottom: 1.5rem; }
    .article-body { font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); margin-bottom: 2rem; }
    .article-body p { margin-bottom: 1.2rem; }
    .article-body h2 { color: var(--text); font-size: 1.4rem; margin: 2rem 0 1rem; }
    .article-body ul { margin: 1rem 0 1rem 2rem; }
    .article-body li { margin-bottom: 0.5rem; }

    .read-more { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--accent); color: #fff; padding: 1rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 700; transition: 0.3s; margin-bottom: 2rem; }
    .read-more:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,71,87,0.3); }

    .share-section { border-top: 1px solid var(--border); padding-top: 2rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .share-section span { color: var(--text-muted); font-size: 0.875rem; }
    .share-btn { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); padding: 0.6rem 1.2rem; border-radius: 10px; cursor: pointer; font-size: 0.875rem; transition: 0.2s; }
    .share-btn:hover { border-color: var(--accent); color: var(--accent); }

    .ad-box { width: 100%; min-height: 250px; background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; color: var(--text-muted); margin: 2rem 0; }

    .related-section { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border); }
    .related-title-section { font-size: 1.3rem; font-weight: 800; margin-bottom: 1.5rem; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .related-card { background: var(--bg-card); border-radius: 14px; overflow: hidden; border: 1px solid var(--border); text-decoration: none; color: inherit; transition: 0.3s; }
    .related-card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .related-card img { width: 100%; height: 120px; object-fit: cover; }
    .related-title { font-size: 0.9rem; font-weight: 600; padding: 0.75rem; line-height: 1.3; }
    .related-meta { font-size: 0.7rem; color: var(--text-muted); padding: 0 0.75rem 0.75rem; }

    .breadcrumb { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; font-size: 0.8rem; color: var(--text-muted); }
    .breadcrumb a { color: var(--text-muted); text-decoration: none; }
    .breadcrumb a:hover { color: var(--accent); }

    footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; }

    @media (max-width: 640px) { main { padding: 1rem; } .article-title { font-size: 1.5rem; } .article-image { height: 250px; } }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <a href="/" class="logo">Viral<span>News</span> Pro</a>
      <a href="/" class="back-btn">← Back to Home</a>
    </div>
  </header>

  <main>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/?cat=${article.category}">${article.category}</a> / <span>Article</span>
    </nav>

    <div class="article-meta">
      <span class="article-badge">${article.category}</span>
      <span class="article-source">📰 ${esc(article.source)}</span>
      <span class="article-time">⏱️ ${timeAgo}</span>
      ${article.translated ? '<span class="translated-badge">🌐 AI Translated</span>' : ''}
    </div>

    ${article.image ? `<img src="${article.image}" alt="${esc(article.title)}" class="article-image">` : ''}

    <h1 class="article-title">${esc(article.title)}</h1>

    <div class="article-body">
      <p>${esc(article.description || 'This is a trending viral news story aggregated from multiple global sources. The article has been ranked highly in our viral news feed based on real-time social engagement metrics including upvotes, comments, and shares.')}</p>
      <p>The story continues to gain traction across major social platforms and news aggregators. Readers are actively discussing and sharing this development.</p>
      <h2>Key Points</h2>
      <ul>
        <li>Story sourced from ${esc(article.source)} with high engagement</li>
        <li>${article.comments || 0} comments and ${article.upvotes || 0} upvotes</li>
        <li>Published ${timeAgo}</li>
        <li>Category: ${article.category}</li>
        <li>Ranked #${article.rank || 'N/A'} in trending feed</li>
      </ul>
      <p>Click the button below to read the complete story from the original source.</p>
    </div>

    <div class="ad-box">
      <!-- ADSTERRA: 300x250 / 336x280 -->
      Adsterra Ad Zone
    </div>

    <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="read-more">Read Full Story →</a>

    <div class="share-section">
      <span>Share:</span>
      <button class="share-btn" onclick="shareStory()">🔗 Copy Link</button>
      <button class="share-btn" onclick="window.open('https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(article.title)}', '_blank')">𝕏 Twitter</button>
      <button class="share-btn" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}', '_blank')">📘 Facebook</button>
      <button class="share-btn" onclick="window.open('https://wa.me/?text=${encodeURIComponent(article.title + ' ' + canonical)}', '_blank')">💬 WhatsApp</button>
      <button class="share-btn" onclick="window.open('https://t.me/share/url?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(article.title)}', '_blank')">✈️ Telegram</button>
    </div>

    <div class="related-section">
      <h2 class="related-title-section">Related Stories</h2>
      <div class="related-grid">${relatedHtml}</div>
    </div>
  </main>

  <footer>
    <p>© 2026 ViralNews Pro. Auto-synced worldwide viral news platform.</p>
    <p style="margin-top:0.5rem;"><a href="/sitemap" style="color:var(--text-muted);">Sitemap</a> • <a href="/privacy" style="color:var(--text-muted);">Privacy</a> • <a href="/" style="color:var(--text-muted);">Home</a></p>
  </footer>

  <script>
    function shareStory() { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Robots-Tag': 'index, follow'
    }
  });
}

function esc(text) { if(!text)return''; return text.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"'); }
function getTimeAgo(d) { const s=Math.floor((new Date()-new Date(d))/1000); if(s<60)return'Just now'; const m=Math.floor(s/60); if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; }
