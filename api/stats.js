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
      const id = (req.query && req.query.id) || '';
      let counts = {};
      if (token) {
        try {
          counts = countsOf((await readLive(token)).data);
        } catch (e) {
          counts = countsOf(readBundled());
        }
      } else {
        counts = countsOf(readBundled());
      }
      if (id) return send(res, 200, { id, downloads: counts[id] || 0 });
      return send(res, 200, { counts });
    }

    if (req.method === 'POST') {
      const payload = (await readJsonBody(req)) || {};
      const id = String(payload.id || '').slice(0, 120);
      if (!/^[a-z0-9\-]+$/i.test(id)) return send(res, 400, { error: 'id invalid' });
      if (!token) return send(res, 503, { error: 'counter not configured' });

      // read-modify-write, thử lại khi xung đột sha (2 tab bấm cùng lúc)
      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        memCache.at = 0; // bỏ cache để đọc sha mới nhất
        const { data, sha } = await readLive(token);
        const cur = (data[id] && typeof data[id].dl === 'number' ? data[id].dl : 0) + 1;
        data[id] = { dl: cur };
        const content = Buffer.from(JSON.stringify(data)).toString('base64');
        const put = await gh(
          'PUT',
          `/repos/${REPO}/contents/${FILE_PATH}`,
          token,
          {
            message: `[skip ci] stats: +1 download ${id}`,
            content,
            branch: BRANCH,
            ...(sha ? { sha } : {}),
          }
        );
        if (put.code === 200 || put.code === 201) {
          memCache = { at: Date.now(), data, sha: JSON.parse(put.body).content.sha };
          return send(res, 200, { id, downloads: cur });
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
