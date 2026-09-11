// /api/stats.js — Đếm lượt bấm tải thật, lưu vào data/stats.json qua GitHub API.
// Vercel: serverless không ghi được file local, nên mọi ghi đều commit lên GitHub
// với message "[skip ci]" để không trigger deploy lại.
// Cần biến môi trường GITHUB_TOKEN (repo scope hoặc fine-grained Contents RW).
// Không có token: GET đọc file tĩnh kèm theo, POST báo 503 (frontend tự bỏ qua).
//
// GET  /api/stats          -> {counts: {gameId: lượt_tải}}
// GET  /api/stats?id=slug  -> {id, downloads}
// POST /api/stats {id}     -> {id, downloads} (đã +1, client tự chống spam bằng localStorage)

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = process.env.GITHUB_REPO || 'bichchixanh-collab/blog';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'data/stats.json';

let memCache = { at: 0, data: {} };
const MEM_TTL = 60 * 1000;

function gh(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          'User-Agent': 'vercel-stats',
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

function readBundled() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'stats.json'), 'utf-8');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}

async function readLive(token) {
  if (Date.now() - memCache.at < MEM_TTL) return { data: memCache.data, sha: memCache.sha };
  const r = await gh(
    'GET',
    `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    token
  );
  if (r.code === 200) {
    const j = JSON.parse(r.body);
    const data = JSON.parse(Buffer.from(j.content, 'base64').toString('utf-8'));
    memCache = { at: Date.now(), data, sha: j.sha };
    return { data, sha: j.sha };
  }
  if (r.code === 404) return { data: {}, sha: null };
  throw new Error(`GitHub read ${r.code}`);
}

function countsOf(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    const n = v && typeof v.dl === 'number' ? v.dl : parseInt(v, 10);
    if (k && !isNaN(n)) out[k] = n;
  }
  return out;
}

const REACTS = ['love', 'ok', 'sad'];
function reactionsOf(data, id) {
  const out = { love: 0, ok: 0, sad: 0 };
  const r = data && data[id] && data[id].reactions;
  if (r && typeof r === 'object') {
    for (const k of REACTS) {
      const n = parseInt(r[k], 10);
      if (!isNaN(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

// Đọc body JSON chắc chắn mọi trường hợp: Vercel có khi parse sẵn (object),
// có khi để chuỗi thô, có khi (text/plain như sendBeacon cũ) không parse gì cả.
function readJsonBody(req) {
  return new Promise((resolve) => {
    const b = req.body;
    if (b && typeof b === 'object') return resolve(b);
    if (typeof b === 'string') {
      try {
        return resolve(JSON.parse(b));
      } catch (e) {
        return resolve({});
      }
    }
    if (!req.on || req.readableEnded) return resolve({});
    const chunks = [];
    let done = false;
    const finish = (val) => {
      if (!done) {
        done = true;
        resolve(val);
      }
    };
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        finish({});
      }
    });
    req.on('error', () => finish({}));
  });
}

// Chống spam: giới hạn số request/IP (best-effort; instance lạnh có thể reset).
const RATE = new Map();
function clientIp(req) {
  try {
    const f = (req.headers && req.headers['x-forwarded-for']) || '';
    const ip = String(f).split(',')[0].trim();
    if (ip) return ip;
    if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress);
  } catch (e) {}
  return 'unknown';
}
function hitRate(ip, route, limit, windowMs) {
  const now = Date.now();
  const key = ip + '|' + route;
  let arr = RATE.get(key);
  if (!Array.isArray(arr)) arr = [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    RATE.set(key, arr);
    return false;
  }
  arr.push(now);
  if (RATE.size > 3000) RATE.clear();
  RATE.set(key, arr);
  return true;
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

    const isPost = req.method === 'POST';
    if (!hitRate(clientIp(req), isPost ? 'stats-post' : 'stats-get', isPost ? 30 : 100, 60 * 1000)) {
      return send(res, 429, { error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
    }

    const token = process.env.GITHUB_TOKEN || '';

    if (req.method === 'GET') {
      const id = (req.query && req.query.id) || '';
      let raw = {};
      if (token) {
        try {
          raw = (await readLive(token)).data;
        } catch (e) {
          raw = readBundled();
        }
      } else {
        raw = readBundled();
      }
      const counts = countsOf(raw);
      if (id) return send(res, 200, { id, downloads: counts[id] || 0, reactions: reactionsOf(raw, id) });
      return send(res, 200, { counts });
    }

    if (req.method === 'POST') {
      const payload = (await readJsonBody(req)) || {};
      const id = String(payload.id || '').slice(0, 120);
      if (!/^[a-z0-9\-]+$/i.test(id)) return send(res, 400, { error: 'id invalid' });
      const react = payload.react == null || payload.react === '' ? null : String(payload.react);
      if (react !== null && REACTS.indexOf(react) < 0) return send(res, 400, { error: 'react invalid' });
      if (!token) return send(res, 503, { error: 'counter not configured' });

      // read-modify-write, thử lại khi xung đột sha (2 tab bấm cùng lúc)
      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        memCache.at = 0; // bỏ cache để đọc sha mới nhất
        const { data, sha } = await readLive(token);
        if (!data[id] || typeof data[id] !== 'object') data[id] = { dl: 0 };
        let cur, out;
        if (react) {
          const r = reactionsOf(data, id);
          r[react] += 1;
          data[id].reactions = r;
          cur = typeof data[id].dl === 'number' ? data[id].dl : 0;
          out = { id, downloads: cur, reactions: r };
        } else {
          cur = (typeof data[id].dl === 'number' ? data[id].dl : 0) + 1;
          data[id].dl = cur;
          out = { id, downloads: cur, reactions: reactionsOf(data, id) };
        }
        const content = Buffer.from(JSON.stringify(data)).toString('base64');
        const put = await gh(
          'PUT',
          `/repos/${REPO}/contents/${FILE_PATH}`,
          token,
          {
            message: `[skip ci] stats: ${react ? 'react ' + react : '+1 download'} ${id}`,
            content,
            branch: BRANCH,
            ...(sha ? { sha } : {}),
          }
        );
        if (put.code === 200 || put.code === 201) {
          memCache = { at: Date.now(), data, sha: JSON.parse(put.body).content.sha };
          return send(res, 200, out);
        }
        if (put.code === 409 || put.code === 422) {
          lastErr = new Error(`conflict ${put.code}`);
          continue;
        }
        try { console.error('stats write failed:', put.code, String(put.body || '').slice(0, 200)); } catch (e) {}
        return send(res, 502, { error: 'Không lưu được, thử lại sau.' });
      }
      return send(res, 409, { error: String((lastErr && lastErr.message) || 'conflict') });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    try { console.error('stats api error:', err && err.message); } catch (e) {}
    return send(res, 500, { error: 'Lỗi hệ thống, thử lại sau.' });
  }
};
