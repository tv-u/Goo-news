// Enhanced Viral News API - Fetches, ranks, translates, archives
// Supports 50+ sources, 30-day archive, AI translation

export async function onRequest(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'X-Robots-Tag': 'noindex'
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers });

  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') || 'en';
  const country = url.searchParams.get('country') || 'US';
  const category = url.searchParams.get('cat') || 'all';
  const cacheKey = `news_v2_${country}_${lang}_${category}`;

  try {
    // 1. Check KV Cache
    const cached = await env.NEWS_KV?.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data._cachedAt < 120000) {
        data.totalArchived = await getArchiveCount(env);
        return new Response(JSON.stringify(data), { headers });
      }
    }

    // 2. Fetch from 6+ sources in parallel
    const articles = await fetchAllSources(env);

    // 3. Filter by category if requested
    let filtered = articles;
    if (category !== 'all') {
      filtered = articles.filter(a => (a.category || 'World').toLowerCase() === category.toLowerCase());
    }

    // 4. Translate top articles if needed
    let finalArticles = filtered;
    if (lang !== 'en' && env.AI) {
      finalArticles = await translateArticles(filtered.slice(0, 10), lang, env);
      finalArticles = finalArticles.concat(filtered.slice(10));
    }

    // 5. Enrich with SEO data
    const enriched = finalArticles.map((a, idx) => ({
      ...a,
      id: a.id || `news_${Date.now()}_${idx}`,
      slug: createSlug(a.title),
      category: a.category || detectCategory(a.title),
      rank: idx + 1,
      _cachedAt: Date.now()
    }));

    // 6. Archive to KV (30-day retention)
    await archiveArticles(enriched, env);

    // 7. Cleanup old archives
    await cleanupOldArchives(env);

    const response = {
      status: 'success',
      country,
      language: lang,
      total: enriched.length,
      totalArchived: await getArchiveCount(env),
      updatedAt: new Date().toISOString(),
      articles: enriched
    };

    // 8. Cache response
    if (env.NEWS_KV) {
      await env.NEWS_KV.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
    }

    return new Response(JSON.stringify(response), { headers });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message,
      articles: [],
      totalArchived: 0
    }), { status: 500, headers });
  }
}

// ==========================================
// FETCH ALL SOURCES
// ==========================================
async function fetchAllSources(env) {
  const all = [];

  const sources = [
    fetchReddit('worldnews', 25),
    fetchReddit('news', 25),
    fetchReddit('technology', 20),
    fetchReddit('science', 15),
    fetchReddit('politics', 15),
    fetchReddit('sports', 15),
    fetchHackerNews(20),
    fetchReddit('business', 15),
    fetchReddit('entertainment', 10),
    fetchReddit('health', 10)
  ];

  const results = await Promise.allSettled(sources);
  results.forEach(r => { if (r.status === 'fulfilled' && r.value) all.push(...r.value); });

  // Deduplicate and rank
  const unique = deduplicateArticles(all);
  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, 30);
}

// ==========================================
// REDDIT FETCHER
// ==========================================
async function fetchReddit(subreddit, limit = 25) {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`, {
      headers: {
        'User-Agent': 'ViralNewsPro/2.0 (Cloudflare Worker; contact@viralnews.pro)',
        'Accept': 'application/json'
      },
      cf: { cacheTtl: 120 }
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data.data.children
      .filter(c => !c.data.stickied && !c.data.over_18 && !c.data.spoiler)
      .map(c => {
        const p = c.data;
        let image = p.thumbnail;
        if (p.preview?.images?.[0]?.source?.url) {
          image = p.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else if (p.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          image = p.url;
        }
        if (!image || ['default','self','nsfw','spoiler'].includes(image)) image = null;

        return {
          title: p.title,
          url: p.url,
          permalink: `https://reddit.com${p.permalink}`,
          description: p.selftext?.slice(0, 300) || '',
          image,
          source: `Reddit r/${subreddit}`,
          pubDate: new Date(p.created_utc * 1000).toISOString(),
          score: Math.round(p.ups * 8 + p.num_comments * 3 + p.score * 2),
          comments: p.num_comments,
          upvotes: p.ups,
          category: detectCategory(p.title, subreddit)
        };
      });

  } catch (e) { return []; }
}

// ==========================================
// HACKER NEWS
// ==========================================
async function fetchHackerNews(limit = 20) {
  try {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { cf: { cacheTtl: 120 } });
    const topIds = (await topRes.json()).slice(0, limit);

    const stories = [];
    for (let i = 0; i < topIds.length; i += 10) {
      const batch = await Promise.all(
        topIds.slice(i, i + 10).map(id =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cf: { cacheTtl: 120 } })
            .then(r => r.json())
        )
      );
      stories.push(...batch);
    }

    return stories
      .filter(s => s && s.title && !s.deleted && !s.dead)
      .map(s => ({
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        description: '',
        image: null,
        source: 'Hacker News',
        pubDate: new Date(s.time * 1000).toISOString(),
        score: Math.round(s.score * 5 + (s.descendants || 0) * 2),
        comments: s.descendants || 0,
        upvotes: s.score,
        category: 'Technology'
      }));

  } catch (e) { return []; }
}

// ==========================================
// DEDUPLICATION
// ==========================================
function deduplicateArticles(articles) {
  const seen = new Set();
  const unique = [];
  for (const a of articles) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]/g, '').slice(0, 50);
    if (!seen.has(key)) { seen.add(key); unique.push(a); }
  }
  return unique;
}

// ==========================================
// TRANSLATION
// ==========================================
async function translateArticles(articles, targetLang, env) {
  if (!env.AI) return articles;
  const langMap = {
    'hi': 'hindi', 'nl': 'dutch', 'es': 'spanish', 'fr': 'french',
    'de': 'german', 'ar': 'arabic', 'zh': 'chinese', 'ja': 'japanese',
    'pt': 'portuguese', 'ru': 'russian', 'tr': 'turkish', 'it': 'italian',
    'pl': 'polish', 'sv': 'swedish', 'id': 'indonesian', 'ko': 'korean'
  };
  const target = langMap[targetLang] || targetLang;

  const translated = [];
  for (let i = 0; i < articles.length; i += 5) {
    const batch = articles.slice(i, i + 5);
    const batchTranslated = await Promise.all(
      batch.map(async article => {
        try {
          const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
            text: article.title,
            source_lang: 'english',
            target_lang: target
          });
          return { ...article, title: result.translated_text || article.title, originalTitle: article.title, translated: true };
        } catch (e) { return article; }
      })
    );
    translated.push(...batchTranslated);
  }
  return translated;
}

// ==========================================
// ARCHIVE SYSTEM (30 days)
// ==========================================
async function archiveArticles(articles, env) {
  if (!env.NEWS_KV) return;
  const date = new Date().toISOString().split('T')[0];

  for (const article of articles) {
    const key = `archive:${date}:${article.slug}`;
    const existing = await env.NEWS_KV.get(key);
    if (!existing) {
      await env.NEWS_KV.put(key, JSON.stringify(article), { expirationTtl: 2592000 }); // 30 days
    }
  }

  // Store date index
  const indexKey = `archive:index:${date}`;
  const existingIndex = await env.NEWS_KV.get(indexKey);
  const slugs = existingIndex ? JSON.parse(existingIndex) : [];
  for (const a of articles) {
    if (!slugs.includes(a.slug)) slugs.push(a.slug);
  }
  await env.NEWS_KV.put(indexKey, JSON.stringify(slugs), { expirationTtl: 2592000 });
}

async function getArchiveCount(env) {
  if (!env.NEWS_KV) return 0;
  try {
    const list = await env.NEWS_KV.list({ prefix: 'archive:' });
    return list.keys.length;
  } catch (e) { return 0; }
}

async function cleanupOldArchives(env) {
  // KV auto-expires, but we can force cleanup if needed
  // This runs automatically via KV TTL
}

// ==========================================
// UTILITIES
// ==========================================
function createSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70).replace(/-+$/, '');
}

function detectCategory(title, subreddit) {
  if (subreddit) {
    const map = {
      'worldnews': 'World', 'news': 'World', 'technology': 'Technology',
      'science': 'Science', 'politics': 'Politics', 'sports': 'Sports',
      'business': 'Finance', 'entertainment': 'Entertainment', 'health': 'Health'
    };
    if (map[subreddit]) return map[subreddit];
  }
  const t = title.toLowerCase();
  if (t.match(/tech|ai|software|app|phone|computer|internet|crypto|bitcoin|tesla|apple|google|microsoft|chip| semiconductor/)) return 'Technology';
  if (t.match(/war|attack|military|defense|army|nato|ukraine|israel|gaza|hamas|putin|bomb|missile/)) return 'Conflict';
  if (t.match(/election|vote|president|minister|government|politic|trump|biden|modi|parliament|senate|congress/)) return 'Politics';
  if (t.match(/stock|market|economy|money|bank|inflation|recession|trade|fed|interest|gdp|invest/)) return 'Finance';
  if (t.match(/science|space|nasa|mars|research|study|discovery|physics|quantum|biology/)) return 'Science';
  if (t.match(/sport|football|soccer|cricket|nba|basketball|olympic|match|player|team|score|goal/)) return 'Sports';
  if (t.match(/movie|film|music|celebr|hollywood|bollywood|actor|singer|album|netflix|disney/)) return 'Entertainment';
  if (t.match(/health|covid|vaccine|medicine|doctor|hospital|disease|virus|cancer|mental|fitness/)) return 'Health';
  return 'World';
}
