// netlify/functions/validate-key.js
import { getStore } from '@netlify/blobs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ valid: false, message: 'Thiếu token' }), {
      status: 400, headers: HEADERS
    });
  }

  try {
    const store = getStore('moonlight-keys');
    const tokenKey = `token-${token}`;

    let tokenData = null;
    try { tokenData = await store.get(tokenKey, { type: 'json' }); } catch {}

    if (!tokenData) {
      return new Response(JSON.stringify({ valid: false, message: 'Token không hợp lệ hoặc đã sử dụng' }), {
        status: 401, headers: HEADERS
      });
    }

    // Kiểm tra hết hạn
    if (tokenData.expireAt && Date.now() > tokenData.expireAt) {
      await store.delete(tokenKey).catch(() => {});
      return new Response(JSON.stringify({ valid: false, message: 'Token đã hết hạn (quá 24 giờ)' }), {
        status: 401, headers: HEADERS
      });
    }

    // Hợp lệ — xóa token (one-time use)
    await store.delete(tokenKey).catch((e) => console.warn('Cannot delete token:', e.message));

    return new Response(JSON.stringify({
      valid: true,
      key: tokenData.key,
      expireAt: tokenData.expireAt,
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('validate-key error:', err);
    return new Response(JSON.stringify({ valid: false, message: 'Lỗi server: ' + err.message }), {
      status: 500, headers: HEADERS
    });
  }
};

export const config = { path: '/.netlify/functions/validate-key' };