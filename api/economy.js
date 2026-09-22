// /api/economy.js — Ví EXP điểm danh + giá tải từng game.
// Khóa = uid (đã đăng nhập, Bearer) hoặc g_<cid> (khách, device-id 24 hex).
// Không cần migrate SQL: lưu data/economy.json qua GitHub API (giống comments).
//
// GET  /api/economy (Bearer hoặc ?cid=..) -> {bal, checked, streak, owned}
// POST /api/economy {op:'checkin'} -> {ok, got, bal, streak, bonus} (1 lần/ngày)
// Ngày chốt theo UTC+7 (VN + WIB). Check-in random 5-10 + streak +5 (3 ngày) / +15 (7 ngày).
// ticket.js require module này để trừ tiền lúc cấp vé (xem chargeForDownload).

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { bearerToken, verifySbToken } = require('./_sb');
const { check: rateCheck, ipOf } = require('./_rate');

const REPO = process.env.GITHUB_REPO || 'bichchixanh-collab/blog';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'data/economy.json';

const CHECKIN_MIN = 5, CHECKIN_MAX = 10;
const STREAK_BONUS = { 7: 15, 3: 5 };

let memCache = { at: 0, map: null, sha: null };
const MEM_TTL = 20 * 1000;

function dayStr(dateMs) {
  try { return new Date((dateMs || Date.now()) + 7 * 3600 * 1000).toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function yesterdayOf(today) {
  try {
    // today là ngày UTC+7 (từ dayStr); lùi 24h rồi tính lại ngày UTC+7.
    const t = Date.parse(today + 'T00:00:00+07:00');
    if (Number.isNaN(t)) return '';
    return new Date(t - 24 * 3600 * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 10);
  } catch { return ''; }
}

function gh(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          'User-Agent': 'vercel-economy',
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
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

function blankRec() { return { bal: 0, last: '', streak: 0, owned: [], bonus: {} }; }
function cleanRec(r) {
  const o = (r && typeof r === 'object') ? r : {};
  return {
    bal: Math.max(0, parseInt(o.bal, 10) || 0),
    last: typeof o.last === 'string' ? o.last.slice(0, 10) : '',
    streak: Math.max(0, Math.min(3650, parseInt(o.streak, 10) || 0)),
    owned: Array.isArray(o.owned) ? o.owned.filter((x) => typeof x === 'string').slice(0, 2000) : [],
    bonus: (o.bonus && typeof o.bonus === 'object' && !Array.isArray(o.bonus)) ? o.bonus : {},
  };
}

function readBundled() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'economy.json'), 'utf-8');
    const j = JSON.parse(raw);
    return (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
  } catch (e) { return {}; }
}

async function readLive(token) {
  if (Date.now() - memCache.at < MEM_TTL && memCache.map) {
    return { map: memCache.map, sha: memCache.sha };
  }
  const r = await gh('GET', `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, token);
  if (r.code === 200) {
    const j = JSON.parse(r.body);
    let map = {};
    try {
      const raw = JSON.parse(Buffer.from(j.content, 'base64').toString('utf-8'));
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) map = raw;
    } catch (e) {}
    memCache = { at: Date.now(), map, sha: j.sha };
    return { map, sha: j.sha };
  }
  if (r.code === 404) return { map: {}, sha: null };
  throw new Error(`GitHub read ${r.code}`);
}

async function writeLive(token, map, sha, message) {
  const content = Buffer.from(JSON.stringify(map)).toString('base64');
  return gh('PUT', `/repos/${REPO}/contents/${FILE_PATH}`, token, {
    message: message || '[skip ci] economy: update',
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
}

function keyOf(uid, cid) {
  if (uid) return 'u_' + String(uid).slice(0, 64);
  if (/^[0-9a-f]{24}$/.test(String(cid || ''))) return 'g_' + String(cid).toLowerCase();
  return '';
}

function pubRec(rec) {
  const today = dayStr();
  return { bal: rec.bal, checked: rec.last === today, streak: rec.streak, owned: rec.owned };
}

// Trừ tiền vé. Trả về {ok:true, owned} hoặc {ok:false, reason:'low_exp', need, bal}.
// Không có token ghi file (hosting chưa cấu hình) -> cho qua miễn phí để không chặn tải.
async function chargeForDownload({ uid, cid, gameId, cost }) {
  const token = process.env.GITHUB_TOKEN || '';
  const need = Math.max(0, Math.min(100000, parseInt(cost, 10) || 0));
  if (!need) return { ok: true, free: true };
  const key = keyOf(uid, cid);
  if (!key) return { ok: false, reason: 'no_key' };
  if (!token) return { ok: true, free: true, noStore: true };
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    memCache.at = 0;
    let map, sha;
    try {
      ({ map, sha } = await readLive(token));
    } catch (e) {
      lastErr = e;
      continue;
    }
    const rec = cleanRec(map[key]);
    if (rec.owned.indexOf(gameId) >= 0) {
      memCache = { at: Date.now(), map, sha };
      return { ok: true, owned: true, bal: rec.bal };
    }
    if (rec.bal < need) return { ok: false, reason: 'low_exp', need, bal: rec.bal };
    rec.bal -= need;
    rec.owned.push(gameId);
    map[key] = rec;
    try {
      const put = await writeLive(token, map, sha, `[skip ci] economy: -${need} ${gameId} (${key})`);
      if (put.code === 200 || put.code === 201) {
        memCache = { at: Date.now(), map, sha: JSON.parse(put.body).content.sha };
        return { ok: true, bal: rec.bal };
      }
      if (put.code === 409 || put.code === 422) {
        lastErr = new Error(`conflict ${put.code}`);
        continue;
      }
      return { ok: false, reason: 'store_failed' };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, reason: String((lastErr && lastErr.message) || 'conflict') };
}

function send(res, code, obj, maxAge = 0) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', maxAge ? `public, max-age=${maxAge}` : 'no-store');
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const b = req.body;
    if (b && typeof b === 'object') return resolve(b);
    if (typeof b === 'string') {
      try { return resolve(JSON.parse(b)); } catch (e) { return resolve({}); }
    }
    if (!req.on || req.readableEnded) return resolve({});
    const chunks = [];
    let done = false;
    const finish = (val) => { if (!done) { done = true; resolve(val); } };
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { finish(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { finish({}); }
    });
    req.on('error', () => finish({}));
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end();
      return;
    }
    const isPost = req.method === 'POST';
    if (!(await rateCheck({ ip: ipOf(req), route: isPost ? 'eco-post' : 'eco-get', limit: isPost ? 20 : 100, windowS: isPost ? 600 : 60 }))) {
      return send(res, 429, { error: 'slow down' });
    }
    const q = req.query || {};
    const p = isPost ? ((await readJsonBody(req)) || {}) : {};
    // Auth: Bearer header trước, rớt về token trong body/query (client gửi kèm sbt).
    let me = verifySbToken(bearerToken(req));
    if (!me) {
      const sbt = String((isPost ? p.sbt : q.sbt) || '').slice(0, 2000);
      if (sbt) me = verifySbToken(sbt);
    }
    const cid = String((isPost ? p.cid : q.cid) || '').toLowerCase().slice(0, 64);
    const key = keyOf(me ? me.uid : null, cid);
    if (!key) return send(res, 400, { error: 'missing auth' });
    const token = process.env.GITHUB_TOKEN || '';
    if (!token) return send(res, 503, { error: 'economy not configured' });

    memCache.at = 0;
    let map, sha;
    try {
      ({ map, sha } = await readLive(token));
    } catch (e) {
      map = readBundled();
      sha = null;
    }
    const rec = cleanRec(map[key]);
    const today = dayStr();

    if (req.method === 'GET') {
      return send(res, 200, pubRec(rec), 0);
    }
    if (isPost && String(p.op || '') === 'checkin') {
      if (rec.last === today) return send(res, 200, { ok: false, reason: 'done', ...pubRec(rec) });
      const rnd = crypto.randomInt(CHECKIN_MIN, CHECKIN_MAX + 1);
      const streak = rec.last === yesterdayOf(today) ? rec.streak + 1 : 1;
      let bonus = 0;
      const tiers = Object.keys(STREAK_BONUS).map(Number).sort((a, b) => b - a);
      for (const t of tiers) { if (streak >= t) { bonus = STREAK_BONUS[t]; break; } }
      const got = rnd + bonus;
      rec.bal += got;
      rec.last = today;
      rec.streak = streak;
      map[key] = rec;
      const put = await writeLive(token, map, sha, `[skip ci] economy: checkin +${got} (${key})`);
      if (put.code !== 200 && put.code !== 201 && sha) {
        // Thử lại 1 lần với bản mới nhất (tranh sha)
        try {
          memCache.at = 0;
          const fresh = await readLive(token);
          const rec2 = cleanRec(fresh.map[key]);
          if (rec2.last === today) return send(res, 200, { ok: false, reason: 'done', ...pubRec(rec2) });
          rec2.bal += got; rec2.last = today; rec2.streak = streak;
          fresh.map[key] = rec2;
          const put2 = await writeLive(token, fresh.map, fresh.sha, `[skip ci] economy: checkin +${got} (${key})`);
          if (put2.code === 200 || put2.code === 201) {
            memCache = { at: Date.now(), map: fresh.map, sha: JSON.parse(put2.body).content.sha };
            return send(res, 200, { ok: true, got, rnd, bonus, ...pubRec(rec2) });
          }
        } catch (e) {}
        return send(res, 502, { error: 'save failed' });
      }
      try { memCache = { at: Date.now(), map, sha: JSON.parse(put.body).content.sha }; } catch (e) { memCache.at = 0; }
      return send(res, 200, { ok: true, got, rnd, bonus, ...pubRec(rec) });
    }
    return send(res, 400, { error: 'bad op' });
  } catch (err) {
    try { console.error('economy api error:', err && err.message); } catch (e) {}
    return send(res, 500, { error: 'error' });
  }
};

module.exports.chargeForDownload = chargeForDownload;
module.exports.dayStr = dayStr;
module.exports.costOf = (g) => {
  const v = parseInt(g && g.dl_cost, 10);
  return Number.isFinite(v) ? Math.max(0, Math.min(100000, v)) : 10;
};
