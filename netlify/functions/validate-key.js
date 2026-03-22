// netlify/functions/validate-key.js
const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const token = event.queryStringParameters?.token;

  if (!token) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ valid: false, message: 'Thiếu token' }),
    };
  }

  try {
    const store = getStore({ name: 'moonlight-keys', consistency: 'strong' });
    const tokenKey = `token-${token}`;

    // Lấy dữ liệu token
    let tokenData;
    try {
      tokenData = await store.get(tokenKey, { type: 'json' });
    } catch {
      tokenData = null;
    }

    if (!tokenData) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ valid: false, message: 'Token không hợp lệ hoặc đã sử dụng' }),
      };
    }

    // Kiểm tra hết hạn
    if (tokenData.expireAt && Date.now() > tokenData.expireAt) {
      // Xóa token hết hạn
      await store.delete(tokenKey).catch(() => {});
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ valid: false, message: 'Token đã hết hạn (quá 24 giờ)' }),
      };
    }

    // ✅ Hợp lệ — xóa token ngay (one-time use)
    await store.delete(tokenKey).catch((e) => {
      console.warn('Could not delete token:', e.message);
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        valid: true,
        key: tokenData.key,
        expireAt: tokenData.expireAt,
      }),
    };
  } catch (err) {
    console.error('validate-key error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ valid: false, message: 'Lỗi server: ' + err.message }),
    };
  }
};