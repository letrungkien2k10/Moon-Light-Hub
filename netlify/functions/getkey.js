const { getStore } = require('@netlify/blobs');

function generateRandomToken(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

exports.handler = async (event) => {
  const store = getStore({ name: 'keys', consistency: 'strong' });
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const keyName = `daily-key-${today}`;

  // 1) GET: return daily key (for debugging or direct fetch)
  if (event.httpMethod === 'GET') {
    let key = await store.get(keyName);

    if (!key) {
      key = `moonlight-${Math.random().toString(36).substring(2, 10)}-${today}`;
      await store.set(keyName, key, { ttl: 86400 }); // expire sau 24h
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ key, expires: today }),
    };
  }

  // 2) POST: create one-time token link for key
  if (event.httpMethod === 'POST') {
    const body = event.body ? JSON.parse(event.body) : {};
    const source = body.source || 'web';

    let key = await store.get(keyName);
    if (!key) {
      key = `moonlight-${Math.random().toString(36).substring(2, 10)}-${today}`;
      await store.set(keyName, key, { ttl: 86400 });
    }

    const token = generateRandomToken(28);
    await store.set(`token-${token}`, key, { ttl: 86400 });

    return {
      statusCode: 200,
      body: JSON.stringify({ token, key, expires: today, source }),
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  };
};
