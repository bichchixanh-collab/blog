// api/user-data.js — đồng bộ TOÀN BỘ dữ liệu cá nhân lên Supabase (thay localStorage).
// Khi đã đăng nhập, Supabase là nguồn chính; localStorage chỉ là cache offline.
// GET  -> {senpai:{xp,data}, stats:{minutes,likes,completed,bingo,pet_xp}} (cần Bearer)
// POST -> body {senpai:{xp,data}} hợp nhất lên server (union/max, không mất data)
const { bearerToken, verifySbTokenAsync, getUserStats } = require('./_sb');
const { check, ipOf } = require('./_rate');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function serviceFetch(path, opts) {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const url = (process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co').replace(/\/$/, '');
  if (!key) throw new Error('no service key');
  const r = await fetch(`${url}${path}`, Object.assign({
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  }, opts || {}));
  const text = await r.text().catch(() => '');
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, json: j };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    try {
      const b = req.body;
      if (b && typeof b === 'object') return resolve(b);
      if (typeof b === 'string' && b) { try { return resolve(JSON.parse(b)); } catch {} return resolve(null); }
    } catch {}
    let raw = '';
    try {
      req.on('data', (c) => { raw += c; });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(null); } });
    } catch { resolve(null); }
  });
}

module.exports = async (req, res) => {
  try {
    const me = await verifySbTokenAsync(bearerToken(req));
    if (!me) { send(res, 401, { error: 'login required' }); return; }
    if (req.method === 'GET') {
      if (!await check({ ip: ipOf(req), route: 'userdata-get', limit: 60, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
      const [senpai, stats] = await Promise.all([
        serviceFetch(`/rest/v1/senpai?user_id=eq.${encodeURIComponent(me.uid)}&select=xp,data,updated_at`).then(r => {
          if (r.status === 200 && Array.isArray(r.json) && r.json.length) return r.json[0];
          return null;
        }).catch(() => null),
        getUserStats(me.uid).catch(() => null),
      ]);
      send(res, 200, { senpai, stats });
      return;
    }
    if (req.method === 'POST') {
      if (!await check({ ip: ipOf(req), route: 'userdata-post', limit: 60, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
      const body = (await readJsonBody(req)) || {};
      const xp = Math.max(0, parseInt(body.xp, 10) || 0);
      const data = (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data : {};
      // Lấy bản cũ để merge (max xp, union data theo updated_at)
      const cur = await serviceFetch(`/rest/v1/senpai?user_id=eq.${encodeURIComponent(me.uid)}&select=xp,data,updated_at`).then(r => {
        if (r.status === 200 && Array.isArray(r.json) && r.json.length) return r.json[0];
        return null;
      }).catch(() => null);
      let finalXp = xp, finalData = data;
      if (cur) {
        finalXp = Math.max(xp, cur.xp || 0);
        // Data lấy bản mới hơn (so updated_at), nếu không có thì giữ bản local mới
        const rt = Date.parse(cur.updated_at || '') || 0;
        // Nếu server mới hơn 30s thì giữ server, ngược lại lấy local (người dùng vừa thao tác)
        if (rt > Date.now() - 30000 && cur.data) {
          // merge nông: giữ các key mới từ local nếu server thiếu
          finalData = Object.assign({}, cur.data, data);
          // pet, gacha giữ max/union đã xử lý ở client, ở đây chỉ merge
        }
      }
      const r = await serviceFetch('/rest/v1/senpai?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: me.uid, xp: finalXp, data: finalData, updated_at: new Date().toISOString() }),
      });
      if (r.status !== 200 && r.status !== 201 && r.status !== 204) { send(res, 503, { error: 'save failed' }); return; }
      send(res, 200, { ok: true, xp: finalXp });
      return;
    }
    send(res, 405, { error: 'method not allowed' });
  } catch (e) { try { console.error('user-data error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
