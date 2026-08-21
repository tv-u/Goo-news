// Geo-location, Language Detection & Analytics Tracking Middleware
// Runs on EVERY request before other functions

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Skip analytics for static assets and API
  const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/);
  const isApi = url.pathname.startsWith('/api/');
  const isAdmin = url.pathname.startsWith('/admin');

  // Get Cloudflare geo data
  const country = request.headers.get('CF-IPCountry') || 'XX';
  const city = request.headers.get('CF-IPCity') || 'Unknown';
  const region = request.headers.get('CF-Region') || 'Unknown';
  const continent = request.headers.get('CF-IPContinent') || 'XX';
  const latitude = request.headers.get('CF-IPLatitude') || '0';
  const longitude = request.headers.get('CF-IPLongitude') || '0';
  const timezone = request.headers.get('CF-Timezone') || 'UTC';

  // Country to Language mapping
  const countryLangMap = {
    'IN': 'hi', 'PK': 'hi', 'BD': 'hi', 'NP': 'hi', 'LK': 'hi',
    'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'IE': 'en', 'NZ': 'en',
    'NL': 'nl', 'BE': 'nl', 'DE': 'de', 'AT': 'de', 'CH': 'de',
    'FR': 'fr', 'MC': 'fr', 'LU': 'fr',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es',
    'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt',
    'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'UA': 'ru',
    'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'SG': 'zh', 'MO': 'zh',
    'JP': 'ja', 'KR': 'ko',
    'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'QA': 'ar', 'KW': 'ar', 'OM': 'ar', 'BH': 'ar', 'JO': 'ar', 'IQ': 'ar', 'LY': 'ar', 'SY': 'ar', 'YE': 'ar', 'LB': 'ar', 'PS': 'ar',
    'TR': 'tr', 'AZ': 'tr',
    'IT': 'it', 'VA': 'it',
    'PL': 'pl',
    'SE': 'sv', 'NO': 'sv', 'DK': 'sv', 'FI': 'sv',
    'ID': 'id', 'MY': 'id'
  };

  const language = countryLangMap[country] || 'en';

  // Generate session ID for live user tracking
  const sessionId = crypto.randomUUID();

  // Track analytics (async, don't block)
  if (!isStatic && !isApi && !isAdmin && env.NEWS_DB) {
    trackAnalytics(request, env, {
      country, city, region, continent, timezone,
      path: url.pathname,
      sessionId,
      userAgent: request.headers.get('User-Agent') || '',
      referrer: request.headers.get('Referer') || ''
    }).catch(() => {});
  }

  // Store live session in KV (5 min TTL)
  if (!isStatic && !isApi && env.NEWS_KV) {
    const sessionKey = `live:${sessionId}`;
    env.NEWS_KV.put(sessionKey, JSON.stringify({country, path: url.pathname, time: Date.now()}), {expirationTtl: 300}).catch(() => {});
  }

  // Process request
  const response = await next();

  // Add custom headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Country', country);
  newHeaders.set('X-City', city);
  newHeaders.set('X-Region', region);
  newHeaders.set('X-Language', language);
  newHeaders.set('X-Continent', continent);
  newHeaders.set('X-Timezone', timezone);
  newHeaders.set('X-Session-Id', sessionId);

  // Security Headers - Zero Trust
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newHeaders.set('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  newHeaders.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  newHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://adsterra.com https://*.adsterra.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src https:; media-src https:;");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Analytics tracking to D1 database
async function trackAnalytics(request, env, data) {
  if (!env.NEWS_DB) return;

  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const hour = timestamp.split(':')[0] + ':00:00';

  try {
    // Insert visit
    await env.NEWS_DB.prepare(
      `INSERT INTO visits (session_id, country, city, region, continent, path, referrer, user_agent, timestamp, date, hour)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(data.sessionId, data.country, data.city, data.region, data.continent, data.path, data.referrer, data.userAgent, timestamp, date, hour).run();

    // Update page_views counter
    await env.NEWS_DB.prepare(`
      INSERT INTO page_views (path, date, views, unique_visitors)
      VALUES (?, ?, 1, 1)
      ON CONFLICT(path, date) DO UPDATE SET
        views = views + 1,
        unique_visitors = unique_visitors + 1
    `).bind(data.path, date).run();

  } catch (e) {
    console.error('Analytics error:', e);
  }
}
