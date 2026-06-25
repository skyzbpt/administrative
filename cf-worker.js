// 領航物理治療所 薪資管理系統 — Cloudflare Worker API

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const { pathname } = new URL(request.url);
    if (pathname !== '/api/db') {
      return new Response('Not Found', { status: 404, headers: cors });
    }

    // ── 驗證密鑰 ──
    const token = request.headers.get('X-Auth-Token');
    if (!env.API_SECRET || token !== env.API_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── GET：讀取 ──
    if (request.method === 'GET') {
      const data = await env.DB_STORE.get('main_db');
      return new Response(data ?? 'null', {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── POST：寫入 ──
    if (request.method === 'POST') {
      const body = await request.text();
      try { JSON.parse(body); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      await env.DB_STORE.put('main_db', body);
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: cors });
  },
};


/* wrangler.toml（與 worker.js 同一資料夾）

name = "lh-payroll-api"
main = "worker.js"
compatibility_date = "2024-09-23"

[[kv_namespaces]]
binding = "DB_STORE"
id = "PASTE_KV_ID_HERE"
*/
