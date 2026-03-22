// netlify/functions/get-key.js
const { getStore } = require('@netlify/blobs');

function randomToken(length = 28) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < length; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function getToday() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  try {
    const store = getStore({ name: 'moonlight-keys', consistency: 'strong' });
    const today = getToday();
    const dailyKeyName = `daily-${today}`;

    // ── GET: Debug / xem key hôm nay ──
    if (event.httpMethod === 'GET') {
      let keyData = await store.get(dailyKeyName, { type: 'json' }).catch(() => null);

      if (!keyData) {
        const newKey = `moonlight-${randomToken(8)}-${today.replace(/-/g, '')}`;
        keyData = { key: newKey, date: today, createdAt: Date.now() };
        // Lưu key hàng ngày, sẽ bị ghi đè vào ngày hôm sau
        await store.setJSON(dailyKeyName, keyData);
      }

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ key: keyData.key, date: keyData.date }),
      };
    }

    // ── POST: Tạo one-time token ──
    if (event.httpMethod === 'POST') {
      let keyData = await store.get(dailyKeyName, { type: 'json' }).catch(() => null);

      if (!keyData) {
        const newKey = `moonlight-${randomToken(8)}-${today.replace(/-/g, '')}`;
        keyData = { key: newKey, date: today, createdAt: Date.now() };
        await store.setJSON(dailyKeyName, keyData);
      }

      // Tạo token một lần
      const token = randomToken(32);
      const expireAt = Date.now() + 24 * 60 * 60 * 1000; // 24h

      // Lưu token với metadata chứa expireAt
      await store.setJSON(`token-${token}`, {
        key: keyData.key,
        expireAt,
        usedAt: null,
      });

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          token,
          key: keyData.key,
          date: today,
          expireAt,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  } catch (err) {
    console.error('get-key error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Internal server error', detail: err.message }),
    };
  }
};