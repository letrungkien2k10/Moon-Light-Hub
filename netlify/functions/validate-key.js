// netlify/functions/validate-key.js
import { getStore } from '@netlify/blobs';
import { checkRateLimit, getClientIP } from './rate-limit.js';

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://moonlighthub.netlify.app',
  'Content-Type': 'application/json',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }

  // ── Rate limiting: tối đa 10 request/phút mỗi IP ──
  const ip = getClientIP(req);
  const limit = await checkRateLimit(ip, 'validate-key', 10, 60000);
  if (!limit.allowed) {
    return new Response(JSON.stringify({
      valid: false,
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      retryAfter: limit.retryAfter
    }), {
      status: 429,
      headers: { ...HEADERS, 'Retry-After': String(limit.retryAfter) }
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ valid: false, message: 'Thiếu token' }), {
      status: 400, headers: HEADERS
    });
  }

  // Validate token format — chặn các input lạ
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) {
    return new Response(JSON.stringify({ valid: false, message: 'Token không hợp lệ' }), {
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

    if (tokenData.expireAt && Date.now() > tokenData.expireAt) {
      await store.delete(tokenKey).catch(() => {});
      return new Response(JSON.stringify({ valid: false, message: 'Token đã hết hạn' }), {
        status: 401, headers: HEADERS
      });
    }

    await store.delete(tokenKey).catch(e => console.warn('Cannot delete token:', e.message));

    return new Response(JSON.stringify({
      valid: true,
      key: tokenData.key,
      expireAt: tokenData.expireAt,
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('validate-key error:', err);
    return new Response(JSON.stringify({ valid: false, message: 'Lỗi server' }), {
      status: 500, headers: HEADERS
    });
  }
};

export const config = { path: '/.netlify/functions/validate-key' };