// netlify/functions/rate-limit.js
// Module helper — import vào các function khác để dùng chung
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'rate-limits';

/**
 * Kiểm tra rate limit cho một IP
 * @param {string} ip - IP của request
 * @param {string} action - Tên action (vd: 'get-key', 'validate-key')
 * @param {number} maxRequests - Số request tối đa
 * @param {number} windowMs - Cửa sổ thời gian (ms)
 */
export async function checkRateLimit(ip, action, maxRequests = 10, windowMs = 60000) {
  try {
    const store = getStore(STORE_NAME);
    const key = `${action}:${ip}`;
    const now = Date.now();

    let data = null;
    try { data = await store.get(key, { type: 'json' }); } catch {}

    if (!data) {
      // Lần đầu request
      await store.setJSON(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    // Reset nếu hết cửa sổ thời gian
    if (now - data.windowStart > windowMs) {
      await store.setJSON(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    // Trong cửa sổ thời gian
    if (data.count >= maxRequests) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    await store.setJSON(key, { count: data.count + 1, windowStart: data.windowStart });
    return { allowed: true, remaining: maxRequests - data.count - 1 };

  } catch (err) {
    // Nếu rate limit lỗi → cho qua (fail open) để không block user thật
    console.warn('Rate limit check failed:', err.message);
    return { allowed: true, remaining: -1 };
  }
}

/**
 * Lấy IP từ request headers (Netlify forward headers)
 */
export function getClientIP(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}