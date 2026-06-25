/**
 * 領航物理治療所 — 行政管理系統雲端同步 Worker
 *
 * 路由：
 *   OPTIONS *       CORS 預檢（瀏覽器自動送出，必須先回 200/204）
 *   GET  /api/db    讀取整個資料庫（需 X-Auth-Token）
 *   POST /api/db    覆寫整個資料庫（需 X-Auth-Token）
 *
 * 部署綁定（名稱必須完全一致，區分大小寫）：
 *   KV Namespace  → 變數名稱  ADMINISTRATIVE
 *   Secret        → 名稱      API_SECRET（要和前台「雲端設定」的密鑰相同）
 */

const KEY = 'db';            // 資料在 KV 內存放的鍵名
const ALLOW_ORIGIN = '*';    // 想鎖網域改成 'https://skyzbpt.github.io'

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN === '*' ? '*' : (origin || ALLOW_ORIGIN),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // 1) CORS 預檢：沒回正確標頭，後續 GET/POST 都會被瀏覽器擋下（最常見的失敗原因）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // 2) 健康檢查 / 友善首頁
    if (url.pathname === '/' || url.pathname === '') {
      return json({ ok: true, service: 'lh-payroll-sync' }, 200, origin);
    }

    // 3) 主要資料端點
    if (url.pathname === '/api/db') {
      // --- 設定檢查 ---
      if (!env.API_SECRET) {
        return json({ error: 'server misconfigured: API_SECRET 尚未設定' }, 500, origin);
      }
      if (!env.ADMINISTRATIVE) {
        return json({ error: 'server misconfigured: KV(ADMINISTRATIVE) 尚未綁定' }, 500, origin);
      }

      // --- 密鑰驗證 ---
      const token = request.headers.get('X-Auth-Token') || '';
      if (token !== env.API_SECRET) {
        return json({ error: 'unauthorized' }, 401, origin);
      }

      // --- 讀取 ---
      if (request.method === 'GET') {
        const stored = await env.ADMINISTRATIVE.get(KEY);
        // 雲端還沒資料時回空物件；前台會保留本機資料，下次存檔自動上傳
        if (!stored) return json({}, 200, origin);
        // 原樣回傳已存的字串，避免重新序列化
        return new Response(stored, {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) },
        });
      }

      // --- 寫入 ---
      if (request.method === 'POST' || request.method === 'PUT') {
        let raw;
        try {
          raw = await request.text();
          const data = JSON.parse(raw);
          // 基本防呆：必須是含 staff 欄位的物件，避免被空資料或壞資料覆蓋
          if (!data || typeof data !== 'object' || data.staff === undefined) {
            return json({ error: 'invalid payload（缺少 staff 欄位）' }, 400, origin);
          }
        } catch (e) {
          return json({ error: 'invalid JSON' }, 400, origin);
        }
        await env.ADMINISTRATIVE.put(KEY, raw);
        return json({ ok: true, savedAt: new Date().toISOString() }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

    // 4) 其他路徑
    return json({ error: 'not found' }, 404, origin);
  },
};
