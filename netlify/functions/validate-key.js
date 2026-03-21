const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };

  const store = getStore({ name: 'keys', consistency: 'strong' });
  const storedKey = await store.get(`token-${token}`);

  if (!storedKey) {
    return { statusCode: 401, body: JSON.stringify({ valid: false, message: 'Invalid or expired token' }) };
  }

  // One-time use: remove token after first successful validation
  if (typeof store.delete === 'function') {
    await store.delete(`token-${token}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ valid: true, key: storedKey }),
  };
};
