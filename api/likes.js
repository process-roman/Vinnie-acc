// The "I want Vinnie" counter. GET reads it, POST adds one. It stores a single number in
// Redis over Upstash's REST API, and nothing about who pressed the button.
// Needs Upstash Redis connected to the Vercel project; it answers 503 until then.

const KEY = 'vinnie:likes';

const storage = () => {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
};

async function redis({ url, token }, command) {
  const res = await fetch(`${url}/${command}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Redis answered ${res.status}`);
  const { result } = await res.json();
  return Number(result ?? 0);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const store = storage();
  if (!store) return res.status(503).json({ error: 'not set up' });
  try {
    const count = await redis(store, req.method === 'POST' ? `incr/${KEY}` : `get/${KEY}`);
    return res.status(200).json({ count });
  } catch (e) {
    console.error('[likes]', e);
    return res.status(502).json({ error: 'storage unavailable' });
  }
};
