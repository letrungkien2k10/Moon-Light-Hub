// netlify/functions/get-key.js
import { getStore } from '@netlify/blobs';
import { checkRateLimit, getClientIP } from './rate-limit.js';

function randomToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < length; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://moonlighthub.netlify.app',
  'Content-Type': 'application/json',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  // ── Rate limiting: tối đa 5 POST/phút mỗi IP ──
  if (req.method === 'POST') {
    const ip = getClientIP(req);
    const limit = await checkRateLimit(ip, 'get-key', 5, 60000);
    if (!limit.allowed) {
      return new Response(JSON.stringify({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter: limit.retryAfter
      }), {
        status: 429,
        headers: {
          ...HEADERS,
          'Retry-After': String(limit.retryAfter),
          'X-RateLimit-Remaining': '0'
        }
      });
    }
  }

  try {
    const store = getStore('moonlight-keys');
    const today = getToday();
    const dailyKeyName = `daily-${today}`;

    if (req.method === 'GET') {
      let keyData = null;
      try { keyData = await store.get(dailyKeyName, { type: 'json' }); } catch {}
      if (!keyData) {
        const newKey = `moonlight-${randomToken(8)}-${today.replace(/-/g, '')}`;
        keyData = { key: newKey, date: today, createdAt: Date.now() };
        await store.setJSON(dailyKeyName, keyData);
      }
      return new Response(JSON.stringify({ key: keyData.key, date: keyData.date }), {
        status: 200, headers: HEADERS
      });
    }

    if (req.method === 'POST') {
      let keyData = null;
      try { keyData = await store.get(dailyKeyName, { type: 'json' }); } catch {}
      if (!keyData) {
        const newKey = `moonlight-${randomToken(8)}-${today.replace(/-/g, '')}`;
        keyData = { key: newKey, date: today, createdAt: Date.now() };
        await store.setJSON(dailyKeyName, keyData);
      }
      const token = randomToken(32);
      const expireAt = Date.now() + 24 * 60 * 60 * 1000;
      await store.setJSON(`token-${token}`, { key: keyData.key, expireAt });
      return new Response(JSON.stringify({ token, key: keyData.key, date: today, expireAt }), {
        status: 200, headers: HEADERS
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: HEADERS
    });

  } catch (err) {
    console.error('get-key error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: HEADERS
    });
  }
};

export const config = { path: '/.netlify/functions/get-key' };