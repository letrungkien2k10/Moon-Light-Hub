// netlify/functions/get-key.js
// Dùng @netlify/blobs built-in của Netlify — không cần cài thêm gì
import { getStore } from '@netlify/blobs';

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
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  try {
    const store = getStore('moonlight-keys');
    const today = getToday();
    const dailyKeyName = `daily-${today}`;

    // GET: xem key hôm nay
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

    // POST: tạo one-time token
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

      await store.setJSON(`token-${token}`, {
        key: keyData.key,
        expireAt,
      });

      return new Response(JSON.stringify({
        token,
        key: keyData.key,
        date: today,
        expireAt,
      }), { status: 200, headers: HEADERS });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: HEADERS
    });

  } catch (err) {
    console.error('get-key error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: err.message }), {
      status: 500, headers: HEADERS
    });
  }
};

export const config = { path: '/.netlify/functions/get-key' };