// netlify/functions/log-key.js
import { getStore } from '@netlify/blobs';
import { checkRateLimit, getClientIP } from './rate-limit.js';

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://moonlighthub.netlify.app',
  'Content-Type': 'application/json',
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function normalizeExpireAt(log) {
  const explicitExpireAt = Number(log?.expireAt || 0);
  if (Number.isFinite(explicitExpireAt) && explicitExpireAt > 0) return explicitExpireAt;

  const usedAt = Number(log?.usedAt || 0);
  if (Number.isFinite(usedAt) && usedAt > 0) return usedAt + KEY_TTL_MS;

  return 0;
}

function pruneExpiredLogs(logs) {
  const now = Date.now();
  return (Array.isArray(logs) ? logs : []).filter((log) => normalizeExpireAt(log) > now);
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  try {
    const store = getStore('moonlight-keys');

    // ── POST: lưu log — rate limit 3 lần/phút mỗi IP ──
    if (req.method === 'POST') {
      const ip = getClientIP(req);
      const limit = await checkRateLimit(ip, 'log-key', 3, 60000);
      if (!limit.allowed) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429, headers: HEADERS
        });
      }

      const body = await req.json().catch(() => ({}));
      const { key, source } = body;
      const expireAt = Number(body?.expireAt || 0);

      if (!key || typeof key !== 'string' || key.length > 200) {
        return new Response(JSON.stringify({ error: 'Thiếu hoặc key không hợp lệ' }), {
          status: 400, headers: HEADERS
        });
      }

      let logs = [];
      try { logs = await store.get('key-logs', { type: 'json' }) || []; } catch {}
      logs = pruneExpiredLogs(logs);

      const normalizedExpireAt = Number.isFinite(expireAt) && expireAt > Date.now()
        ? expireAt
        : Date.now() + KEY_TTL_MS;

      const exists = logs.some(l => l.key === key);
      if (!exists) {
        logs.unshift({
          key,
          source: source || 'user',
          ip: ip.substring(0, 8) + '***', // ẩn bớt IP
          usedAt: Date.now(),
          usedAtStr: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
          expireAt: normalizedExpireAt,
          expireAtStr: new Date(normalizedExpireAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        });
        if (logs.length > 200) logs = logs.slice(0, 200);
      }
      await store.setJSON('key-logs', logs);

      return new Response(JSON.stringify({ success: true, total: logs.length }), {
        status: 200, headers: HEADERS
      });
    }

    // ── GET: lấy danh sách — chỉ admin ──
    if (req.method === 'GET') {
      const authHeader = req.headers.get('x-admin-key') || '';
      const ADMIN_KEY = (typeof Netlify !== 'undefined' ? Netlify.env.get('ADMIN_KEY') : null) || 'moonlightadmin';

      if (!authHeader || authHeader !== ADMIN_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: HEADERS
        });
      }

      let logs = [];
      try { logs = await store.get('key-logs', { type: 'json' }) || []; } catch {}
      const activeLogs = pruneExpiredLogs(logs);
      if (activeLogs.length !== logs.length) {
        await store.setJSON('key-logs', activeLogs);
      }

      let todayKey = null;
      try {
        const todayData = await store.get(`daily-${getToday()}`, { type: 'json' });
        todayKey = todayData?.key || null;
      } catch {}

      return new Response(JSON.stringify({ logs: activeLogs, total: activeLogs.length, todayKey }), {
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
