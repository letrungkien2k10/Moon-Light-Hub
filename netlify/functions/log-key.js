// netlify/functions/log-key.js
// Lưu log key đã dùng + trả danh sách cho manager
import { getStore } from '@netlify/blobs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  try {
    const store = getStore('moonlight-keys');

    // ── POST: lưu log key đã dùng ──
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { key, source } = body;

      if (!key) {
        return new Response(JSON.stringify({ error: 'Thiếu key' }), {
          status: 400, headers: HEADERS
        });
      }

      // Lấy danh sách log hiện tại
      let logs = [];
      try {
        logs = await store.get('key-logs', { type: 'json' }) || [];
      } catch {}

      // Thêm log mới (tránh trùng key)
      const exists = logs.some(l => l.key === key);
      if (!exists) {
        logs.unshift({
          key,
          source: source || 'user',
          usedAt: Date.now(),
          usedAtStr: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        });
        // Giữ tối đa 200 log gần nhất
        if (logs.length > 200) logs = logs.slice(0, 200);
        await store.setJSON('key-logs', logs);
      }

      return new Response(JSON.stringify({ success: true, total: logs.length }), {
        status: 200, headers: HEADERS
      });
    }

    // ── GET: trả danh sách log cho manager ──
    if (req.method === 'GET') {
      // Xác thực bằng header password đơn giản
      const authHeader = req.headers.get('x-admin-key') || '';
      const ADMIN_KEY = process.env.ADMIN_KEY || 'moonlightadmin';

      if (authHeader !== ADMIN_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: HEADERS
        });
      }

      let logs = [];
      try {
        logs = await store.get('key-logs', { type: 'json' }) || [];
      } catch {}

      return new Response(JSON.stringify({ logs, total: logs.length }), {
        status: 200, headers: HEADERS
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: HEADERS
    });

  } catch (err) {
    console.error('log-key error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: HEADERS
    });
  }
};

export const config = { path: '/.netlify/functions/log-key' };