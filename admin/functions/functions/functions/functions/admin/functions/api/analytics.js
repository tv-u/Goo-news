// Analytics Tracking API
export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const body = await request.json();
    const country = request.headers.get('X-Country') || 'XX';
    const city = request.headers.get('X-City') || 'Unknown';
    const sessionId = request.headers.get('X-Session-Id') || crypto.randomUUID();

    // Also track in KV for real-time counts
    if (env.NEWS_KV) {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      // Daily counter
      const dayKey = `analytics:daily:${today}`;
      const dayCount = await env.NEWS_KV.get(dayKey);
      await env.NEWS_KV.put(dayKey, String((parseInt(dayCount) || 0) + 1), { expirationTtl: 86400 * 35 });

      // Hourly counter
      const hourKey = `analytics:hourly:${today}:${hour}`;
      const hourCount = await env.NEWS_KV.get(hourKey);
      await env.NEWS_KV.put(hourKey, String((parseInt(hourCount) || 0) + 1), { expirationTtl: 86400 * 2 });

      // Country counter
      const countryKey = `analytics:country:${today}:${country}`;
      const countryCount = await env.NEWS_KV.get(countryKey);
      await env.NEWS_KV.put(countryKey, String((parseInt(countryCount) || 0) + 1), { expirationTtl: 86400 * 35 });

      // Page counter
      const pageKey = `analytics:page:${today}:${body.path || '/'}`;
      const pageCount = await env.NEWS_KV.get(pageKey);
      await env.NEWS_KV.put(pageKey, String((parseInt(pageCount) || 0) + 1), { expirationTtl: 86400 * 35 });
    }

    return new Response(JSON.stringify({ status: 'tracked' }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', message: e.message }), { status: 500, headers });
  }
}
