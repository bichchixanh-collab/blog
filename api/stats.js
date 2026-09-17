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
    req.setTimeout(7000, () => { try { req.destroy(new Error('github timeout')); } catch (e) {} });
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

// Dùng chung rate-limit (Upstash khi có env, fallback memory).
const { check: rateCheck, ipOf } = require('./_rate');
// 'same' | 'cross' | 'unverified' — thiếu Origin không còn tự động cho qua.
// 'same' = đúng host, hoặc cùng nền tảng *.vercel.app (preview deployment,
// www/non-www, domain phụ cùng dự án), hoặc khớp SITE_URL — khớp quy ước _lib.js.
function originStatus(req) {
  const o = req.headers.origin || req.headers.referer || '';
  if (!o) return 'unverified';
  let oh = '';
  try { oh = new URL(o).host.toLowerCase(); } catch { return 'cross'; }
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  if (oh === host) return 'same';
  if (oh.endsWith('.vercel.app')) return 'same';
  try {
    if (process.env.SITE_URL && oh === new URL(process.env.SITE_URL).host.toLowerCase()) return 'same';
  } catch {}
  return 'cross';
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      const _o = req.headers.origin || '';
      try { if (_o && new URL(_o).host === String(req.headers.host).split(':')[0]) res.setHeader('Access-Control-Allow-Origin', _o); } catch {}
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    const isPost = req.method === 'POST';
    if (!(await rateCheck({ ip: ipOf(req), route: isPost ? 'stats-post' : 'stats-get', limit: isPost ? 30 : 100, windowS: 60 }))) {
      return send(res, 429, { error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
    }
    const _origin = isPost ? originStatus(req) : 'same';
    if (isPost && _origin === 'cross') return send(res, 403, { error: 'cross-origin denied' });
    // 'unverified' (không gửi Origin/Referer): không chặn cứng để tránh chặn nhầm
    // app/WAP cũ thật sự không gửi header này, nhưng siết trần rate-limit mạnh hơn
    // hẳn — bot giả curl cũng chỉ đạt tối đa mức này thay vì full limit.
    if (isPost && _origin === 'unverified' && !(await rateCheck({ ip: ipOf(req), route: 'unverified-origin', limit: 10, windowS: 60 }))) {
      return send(res, 429, { error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
    }

    const token = process.env.GITHUB_TOKEN || '';

    if (req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*'); // GET public: cho phép đọc chéo
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
      if (id) return send(res, 200, { id, downloads: counts[id] || 0 });
      return send(res, 200, { counts });
    }

    if (req.method === 'POST') {
      const payload = (await readJsonBody(req)) || {};
      const id = String(payload.id || '').slice(0, 120);
      if (!/^[a-z0-9\-]+$/i.test(id)) return send(res, 400, { error: 'id invalid' });
      const _ip = ipOf(req);
      // Trần ngày/IP để 1 IP không bơm hàng chục nghìn lượt (bot đổi IP vẫn qua được — xem Cloudflare/Turnstile).
      if (!(await rateCheck({ ip: _ip, route: 'dl-day', limit: 200, windowS: 86400 }))) return send(res, 429, { error: 'slow down' });
      if ((token || '').startsWith('ghp_')) try { console.warn('[sec] classic PAT in use — nên đổi sang fine-grained chỉ RW data/stats.json'); } catch {}
      // Lượt tải thuần: gom qua _store (Redis nếu có, không thì cộng dồn + flush 1 commit/phút)
      // thay vì 1 commit GitHub/lượt — hết conflict khi nhiều người bấm cùng lúc.
      try {
        const { countDl } = require('./_store');
        const n = await countDl(id);
        return send(res, 200, { id, downloads: n });
      } catch (e) { /* rớt xuống luồng ghi trực tiếp bên dưới */ }
      if (!token) return send(res, 503, { error: 'counter not configured' });

      // read-modify-write, thử lại khi xung đột sha (2 tab bấm cùng lúc)
      let lastErr = null;
      // Tối đa 2 vòng: mỗi vòng 2 call GitHub × timeout 7s; 3 vòng có thể vượt 10s giới hạn của Vercel Hobby.
      for (let attempt = 0; attempt < 2; attempt++) {
        memCache.at = 0; // bỏ cache để đọc sha mới nhất
        const { data, sha } = await readLive(token);
        if (!data[id] || typeof data[id] !== 'object') data[id] = { dl: 0 };
        const cur = (typeof data[id].dl === 'number' ? data[id].dl : 0) + 1;
        data[id].dl = cur;
        const out = { id, downloads: cur };
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
