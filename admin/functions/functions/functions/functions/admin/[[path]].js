// Admin Panel Route Protection
// Serves admin/index.html with Basic Auth

const ADMIN_USER = 'dhamtan';
const ADMIN_PASS = 'Thakur1995@';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Check Basic Auth
  const auth = request.headers.get('Authorization');
  if (!auth || !checkAuth(auth)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="ViralNews Pro Admin"',
        'Content-Type': 'text/plain'
      }
    });
  }

  // Serve admin HTML
  const adminHtml = await getAdminHTML(env);
  return new Response(adminHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store'
    }
  });
}

function checkAuth(authHeader) {
  try {
    const base64 = authHeader.replace('Basic ', '');
    const decoded = atob(base64);
    const [user, pass] = decoded.split(':');
    return user === ADMIN_USER && pass === ADMIN_PASS;
  } catch (e) {
    return false;
  }
}

async function getAdminHTML(env) {
  // In production, this would read from KV or a static file
  // For now, redirect to the static admin/index.html
  return `<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="0;url=/admin/index.html"></head>
<body>Redirecting...</body>
</html>`;
}
