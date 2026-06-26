// /api/tasks.js — miðlæg geymsla á verkefnalistanum svo sama sjáist í síma og tölvu.
// Notar Upstash Redis (Vercel KV) gegnum REST. Engin innskráning — einn sameiginlegur listi.
// Umhverfisbreytur koma sjálfkrafa þegar KV/Upstash er tengt við Vercel-verkefnið.

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL;
const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN;

const KEY = 'radd:tasks';

async function redis(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('KV ' + r.status);
  return r.json(); // { result: ... }
}

module.exports = async (req, res) => {
  // Ekki tengt enn -> appið notar bara localStorage (per-tæki).
  if (!URL || !TOKEN) {
    res.status(200).json({ configured: false });
    return;
  }

  try {
    if (req.method === 'GET') {
      const out = await redis(['GET', KEY]);
      let tasks = null;
      if (out && out.result) {
        try { tasks = JSON.parse(out.result); } catch (e) { tasks = null; }
      }
      res.status(200).json({ configured: true, tasks });
      return;
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf8') || '{}';
      let data;
      try { data = JSON.parse(body); } catch (e) { data = {}; }
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (tasks.length > 5000) {
        res.status(413).json({ error: 'Of mörg verkefni' });
        return;
      }
      await redis(['SET', KEY, JSON.stringify(tasks)]);
      res.status(200).json({ configured: true, ok: true });
      return;
    }

    res.status(405).json({ error: 'Aðeins GET/POST' });
  } catch (e) {
    res.status(500).json({ configured: true, error: String((e && e.message) || e) });
  }
};
