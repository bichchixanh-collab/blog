// /api/comments.js — Bình luận + đánh giá sao, lưu vào data/comments.json qua GitHub API.
// Bình luận mới ở trạng thái "pending", admin duyệt trong admin.php rồi mới hiện.
// Cần biến môi trường GITHUB_TOKEN để ghi; không có token thì GET đọc file tĩnh,
// POST báo 503 (frontend hiện thông báo nhẹ).
//
// GET  /api/comments?game=slug -> {game, avg, total, comments: [{name, stars, text, created_at}]}
// POST /api/comments {game, name, stars, text, website?} -> {ok:true} (pending)

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = process.env.GITHUB_REPO || 'bichchixanh-collab/blog';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'data/comments.json';

let memCache = { at: 0, list: null, sha: null };
const MEM_TTL = 30 * 1000;

function gh(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          'User-Agent': 'vercel-comments',
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ code: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function readBundledList() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'comments.json'), 'utf-8');
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch (e) {
    return [];
  }
}

async function readLive(token) {
  if (Date.now() - memCache.at < MEM_TTL && memCache.list) {
    return { list: memCache.list, sha: memCache.sha };
  }
  const r = await gh('GET', `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, token);
  if (r.code === 200) {
    const j = JSON.parse(r.body);
    const list = JSON.parse(Buffer.from(j.content, 'base64').toString('utf-8'));
    memCache = { at: Date.now(), list: Array.isArray(list) ? list : [], sha: j.sha };
    return { list: memCache.list, sha: j.sha };
  }
  if (r.code === 404) return { list: [], sha: null };
  throw new Error(`GitHub read ${r.code}`);
}

function validGameId(id) {
  if (!/^[a-z0-9\-]{1,120}$/i.test(id)) return false;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8');
    return JSON.parse(raw).some((g) => g && g.id === id);
  } catch (e) {
    return true; // không đọc được danh mục thì cho qua, tránh chặn nhầm
  }
}

function summarize(list, game) {
  const rows = list
    .filter((c) => c && c.game === game && c.status === 'approved')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const total = rows.length;
  const avg = total
    ? Math.round((rows.reduce((s, c) => s + (c.stars || 0), 0) / total) * 10) / 10
    : 0;
  return {
    game,
    avg,
    total,
    comments: rows.slice(0, 50).map((c) => ({
      name: String(c.name || '').slice(0, 30),
      stars: Math.min(5, Math.max(1, c.stars | 0)),
      text: String(c.text || '').slice(0, 500),
      created_at: c.created_at || '',
    })),
  };
}

function send(res, code, obj, maxAge = 30) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    const token = process.env.GITHUB_TOKEN || '';

    if (req.method === 'GET') {
      const game = String((req.query && req.query.game) || '').slice(0, 120);
      if (!game) return send(res, 400, { error: 'missing game' });
      let list;
      if (token) {
        try {
          list = (await readLive(token)).list;
        } catch (e) {
          list = readBundledList();
        }
      } else {
        list = readBundledList();
      }
      return send(res, 200, summarize(list, game));
    }

    if (req.method === 'POST') {
      let p = req.body;
      if (typeof p === 'string') {
        try {
          p = JSON.parse(p);
        } catch (e) {
          p = {};
        }
      }
      p = p || {};
      if (String(p.website || '').trim() !== '') return send(res, 200, { ok: true }); // bẫy bot: im lặng cho qua
      const game = String(p.game || '').slice(0, 120);
      const name = String(p.name || '').trim().slice(0, 30);
      const text = String(p.text || '').trim().slice(0, 500);
      const stars = Math.min(5, Math.max(1, parseInt(p.stars, 10) || 0));
      if (!validGameId(game)) return send(res, 400, { error: 'game invalid' });
      if (name.length < 2) return send(res, 400, { error: 'name too short' });
      if (text.length < 2) return send(res, 400, { error: 'text too short' });
      if (!stars) return send(res, 400, { error: 'stars invalid' });
      if (!token) return send(res, 503, { error: 'comments not configured' });

      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        memCache.at = 0;
        const { list, sha } = await readLive(token);
        list.push({
          id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          game,
          name,
          stars,
          text,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        const content = Buffer.from(JSON.stringify(list)).toString('base64');
        const put = await gh('PUT', `/repos/${REPO}/contents/${FILE_PATH}`, token, {
          message: `[skip ci] comments: new pending on ${game}`,
          content,
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        });
        if (put.code === 200 || put.code === 201) {
          memCache = { at: Date.now(), list, sha: JSON.parse(put.body).content.sha };
          return send(res, 200, { ok: true }, 0);
        }
        if (put.code === 409 || put.code === 422) {
          lastErr = new Error(`conflict ${put.code}`);
          continue;
        }
        return send(res, 502, { error: `GitHub write ${put.code}` });
      }
      return send(res, 409, { error: String((lastErr && lastErr.message) || 'conflict') });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
};
