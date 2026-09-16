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
const { bearerToken, verifySbToken } = require('./_sb');

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
    req.setTimeout(7000, () => { try { req.destroy(new Error('github timeout')); } catch (e) {} });
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

// Đếm bình luận ĐÃ DUYỆT theo tên hiển thị (phục vụ điều kiện khóa tải).
// Không tài khoản nên tin ở mức "tên ai người đó giữ"; chống ké tên lạ bằng rate-limit.
async function loadList() {
  const token = process.env.GITHUB_TOKEN || '';
  if (token) {
    try { return (await readLive(token)).list; } catch (e) { /* rớt xuống bản tĩnh */ }
  }
  return readBundledList();
}
function normName(s) { return String(s || '').trim().toLowerCase().slice(0, 30); }
async function countApproved(names, uid) {
  try {
    const list = await loadList();
    // Đã đăng nhập: đếm CHÍNH XÁC theo uid (chống ké tên). Khách: đếm theo tên (mềm).
    if (uid) {
      let n = 0;
      for (const c of list) {
        if (c && c.status === 'approved' && c.uid === uid) n++;
      }
      return n;
    }
    const want = (Array.isArray(names) ? names : []).map(normName).filter(Boolean).slice(0, 5);
    if (!want.length) return 0;
    let n = 0;
    for (const c of list) {
      if (c && c.status === 'approved' && want.indexOf(normName(c.name)) >= 0) n++;
    }
    return n;
  } catch (e) { return 0; }
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

function pubComment(c) {
  return {
    id: c.id || '',
    name: String(c.name || '').slice(0, 30),
    stars: c.parentId ? 0 : Math.min(5, Math.max(1, c.stars | 0)),
    text: String(c.text || '').slice(0, 500),
    created_at: c.created_at || '',
    replies: [],
  };
}

function summarize(list, game) {
  const approved = list.filter((c) => c && c.game === game && c.status === 'approved');
  const tops = approved
    .filter((c) => !c.parentId)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const byParent = {};
  approved
    .filter((c) => c.parentId)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .forEach((c) => {
      (byParent[c.parentId] = byParent[c.parentId] || []).push(c);
    });
  const total = tops.length;
  const avg = total
    ? Math.round((tops.reduce((s, c) => s + (c.stars || 0), 0) / total) * 10) / 10
    : 0;
  return {
    game,
    avg,
    total,
    comments: tops.slice(0, 50).map((c) => {
      const o = pubComment(c);
      o.replies = (byParent[c.id] || []).slice(0, 20).map(pubComment);
      return o;
    }),
  };
}

function send(res, code, obj, maxAge = 30) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  res.end(JSON.stringify(obj));
}

// Đọc body JSON mọi trường hợp (đã parse / chuỗi thô / stream chưa đọc).
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

// Dùng chung rate-limit (Upstash khi có env, fallback memory) — thay Map local dễ reset khi cold-start.
const { check: rateCheck, ipOf } = require('./_rate');

async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET) return true; // chưa cấu hình: giữ honeypot+ratelimit, không chặn
  try {
    const sig = (() => { try { return AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined; } catch { return undefined; } })();
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', signal: sig, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(token || ''), remoteip: ip }),
    });
    const j = await r.json();
    return !!(j && j.success);
  } catch { return false; }
}
// 'same' | 'cross' | 'unverified' — KHÔNG coi thiếu Origin là hợp lệ mặc định.
// POST không xác định được origin bị chặn cứng như 'cross' (xem chỗ gọi bên dưới);
// khác với dl.js/stats.js nơi hành vi thiếu Origin ít nhạy cảm hơn, ở comments
// (ghi nội dung công khai chờ duyệt) siết chặt ngay từ đầu là hợp lý hơn.
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
    if (!(await rateCheck({ ip: ipOf(req), route: isPost ? 'cmt-post' : 'cmt-get', limit: isPost ? 10 : 100, windowS: isPost ? 600 : 60 }))) {
      return send(res, 429, { error: 'Thao tác quá nhanh, thử lại sau ít phút.' });
    }
    // Chặn cả 'cross' lẫn 'unverified' — chỉ request xác nhận rõ same-origin mới qua.
    if (isPost && originStatus(req) !== 'same') return send(res, 403, { error: 'cross-origin denied' });
    // Trần ngày: 10 phút chặn burst, 30/ngày chặn cày xuyên ngày. Hàng chờ duyệt nên spam chỉ ngập queue admin, không hiện public.
    if (isPost && !(await rateCheck({ ip: ipOf(req), route: 'cmt-day', limit: 30, windowS: 86400 }))) return send(res, 429, { error: 'slow down' });

    const token = process.env.GITHUB_TOKEN || '';

    if (req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*'); // GET public: cho phép đọc chéo
      // Đếm bình luận đã duyệt của tôi: ?mine=1&names=Ten1,Ten2 (tối đa 5 tên),
      // hoặc kèm Bearer token để đếm chính xác theo tài khoản.
      if (String((req.query && req.query.mine) || '') === '1') {
        const me = verifySbToken(bearerToken(req));
        if (me) {
          const n = await countApproved([], me.uid);
          return send(res, 200, { mine: n, hard: true }, 60);
        }
        const names = String((req.query && req.query.names) || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
        if (!names.length || names.some((s) => s.length > 30)) return send(res, 400, { error: 'missing names' });
        const n = await countApproved(names, null);
        return send(res, 200, { mine: n }, 60);
      }
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
      const p = (await readJsonBody(req)) || {};
      if (String(p.website || '').trim() !== '') return send(res, 200, { ok: true }); // bẫy bot: im lặng cho qua
      if (!(await verifyTurnstile(p.turnstile, ipOf(req)))) return send(res, 403, { error: 'captcha failed' });
      const game = String(p.game || '').slice(0, 120);
      const name = String(p.name || '').trim().slice(0, 30);
      const text = String(p.text || '').trim().slice(0, 500);
      const replyTo = String(p.replyTo || '').slice(0, 64);
      const stars = Math.min(5, Math.max(1, parseInt(p.stars, 10) || 0));
      // Gắn uid nếu gửi kèm access_token hợp lệ (đếm duyệt chính xác cho khóa cứng)
      let cmtUid = null;
      try {
        const tok = String(p.sbt || '');
        if (tok) { const me = verifySbToken(tok); if (me) cmtUid = me.uid; }
      } catch (e) {}
      if (!validGameId(game)) return send(res, 400, { error: 'game invalid' });
      if (name.length < 2) return send(res, 400, { error: 'name too short' });
      if (text.length < 2) return send(res, 400, { error: 'text too short' });
      if (!replyTo && !stars) return send(res, 400, { error: 'stars invalid' });
      if (!token) return send(res, 503, { error: 'comments not configured' });

      let lastErr = null;
      // Tối đa 2 vòng: mỗi vòng 2 call GitHub × timeout 7s; 3 vòng có thể vượt 10s giới hạn của Vercel Hobby.
      for (let attempt = 0; attempt < 2; attempt++) {
        memCache.at = 0;
        const { list, sha } = await readLive(token);
        let parentId = null;
        if (replyTo) {
          const parent = list.find((c) => c && c.id === replyTo && c.game === game && !c.parentId);
          if (!parent || parent.status !== 'approved') {
            return send(res, 400, { error: 'reply target invalid' });
          }
          parentId = parent.id;
        }
        list.push({
          id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          game,
          name,
          stars: parentId ? 0 : stars,
          text,
          status: 'pending',
          created_at: new Date().toISOString(),
          ...(parentId ? { parentId } : {}),
          ...(cmtUid ? { uid: cmtUid } : {}),
        });
        const content = Buffer.from(JSON.stringify(list)).toString('base64');
        const put = await gh('PUT', `/repos/${REPO}/contents/${FILE_PATH}`, token, {
          message: `[skip ci] comments: new pending ${parentId ? 'reply ' : ''}on ${game}`,
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
        try { console.error('comments write failed:', put.code, String(put.body || '').slice(0, 200)); } catch (e) {}
        return send(res, 502, { error: 'Không lưu được, thử lại sau.' });
      }
      return send(res, 409, { error: String((lastErr && lastErr.message) || 'conflict') });
    }

    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    try { console.error('comments api error:', err && err.message); } catch (e) {}
    return send(res, 500, { error: 'Lỗi hệ thống, thử lại sau.' });
  }
};
module.exports.countApproved = countApproved;
module.exports.loadList = loadList;
