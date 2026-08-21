// Admin Stats API - Real-time analytics data
const ADMIN_USER = 'dhamtan';
const ADMIN_PASS = 'Thakur1995@';

export async function onRequest(context) {
  const { request, env } = context;

  // Basic Auth Check
  const auth = request.headers.get('Authorization');
  if (!auth || !checkAuth(auth)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Basic realm="Admin Panel"'
      }
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  };

  try {
    const stats = await getStats(env);
    return new Response(JSON.stringify({ status: 'success', ...stats }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', message: e.message }), { status: 500, headers });
  }
}

function checkAuth(authHeader) {
  const base64 = authHeader.replace('Basic ', '');
  const decoded = atob(base64);
  const [user, pass] = decoded.split(':');
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

async function getStats(env) {
  const now = new Date();
  const stats = {
    liveUsers: 0,
    last1Hour: 0,
    last24Hours: 0,
    last7Days: 0,
    last28Days: 0,
    totalAllTime: 0,
    topCountries: [],
    topPages: [],
    hourlyBreakdown: [],
    dailyBreakdown: [],
    newsStats: { total: 0, today: 0 }
  };

  if (!env.NEWS_KV) return stats;

  // Live users (sessions active in last 5 min)
  const liveList = await env.NEWS_KV.list({ prefix: 'live:' });
  stats.liveUsers = liveList.keys.length;

  // Hourly breakdown (last 24 hours)
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toISOString().split('T')[0];

  for (let h = 0; h < 24; h++) {
    const key = `analytics:hourly:${today}:${h}`;
    const count = await env.NEWS_KV.get(key);
    stats.hourlyBreakdown.push({ hour: h, count: parseInt(count) || 0 });
  }

  // Daily breakdown (last 28 days)
  const countryMap = {};
  const pageMap = {};

  for (let i = 0; i < 28; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];

    const dayKey = `analytics:daily:${dStr}`;
    const dayCount = await env.NEWS_KV.get(dayKey);
    const count = parseInt(dayCount) || 0;

    stats.dailyBreakdown.push({ date: dStr, count });
    stats.last28Days += count;
    if (i < 7) stats.last7Days += count;
    if (i === 0) stats.last24Hours = count;
    stats.totalAllTime += count;

    // Country stats for today
    if (i === 0) {
      const countryList = await env.NEWS_KV.list({ prefix: `analytics:country:${dStr}:` });
      for (const key of countryList.keys) {
        const c = key.name.split(':')[3];
        const val = await env.NEWS_KV.get(key.name);
        countryMap[c] = (countryMap[c] || 0) + parseInt(val || 0);
      }

      // Page stats
      const pageList = await env.NEWS_KV.list({ prefix: `analytics:page:${dStr}:` });
      for (const key of pageList.keys) {
        const p = key.name.split(':').slice(3).join(':');
        const val = await env.NEWS_KV.get(key.name);
        pageMap[p] = (pageMap[p] || 0) + parseInt(val || 0);
      }
    }
  }

  // Last 1 hour
  const currentHour = now.getHours();
  const hourKey = `analytics:hourly:${today}:${currentHour}`;
  const hourCount = await env.NEWS_KV.get(hourKey);
  stats.last1Hour = parseInt(hourCount) || 0;

  // Sort and limit
  stats.topCountries = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  stats.topPages = Object.entries(pageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([page, count]) => ({ page, count }));

  // News stats
  const newsList = await env.NEWS_KV.list({ prefix: 'archive:' });
  stats.newsStats.total = newsList.keys.length;
  const todayNews = await env.NEWS_KV.list({ prefix: `archive:${today}:` });
  stats.newsStats.today = todayNews.keys.length;

  return stats;
}
