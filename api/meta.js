// api/meta.js — thông tin public cho go.html?ticket=...
// CHỈ trả hostname (để hiện cảnh báo host lạ), KHÔNG BAO GIỜ trả URL file.
// GET /api/meta?ticket= -> {game:{id,name,res,thumb,gate}, host:{res:hostname}}
const fs = require('fs'), path = require('path');
const { check, ipOf } = require('./_rate');
const { verifyTicket, gateHash, resolveJarUrl } = require('./_lock');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function loadGames() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8')); } catch { return []; }
}
module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') { send(res, 405, { error: 'method not allowed' }); return; }
    if (!await check({ ip: ipOf(req), route: 'meta', limit: 100, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
    const t = verifyTicket(req.query && req.query.ticket);
    if (!t) { send(res, 403, { error: 'bad ticket' }); return; }
    const games = loadGames();
    const g = games.find((x) => x && x.id === t.id);
    if (!g) { send(res, 404, { error: 'not found' }); return; }
    // Chuẩn hóa gate giống hệt ticket.js để hash khớp
    let gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
    if (!gate) {
      gate = { type: 'stats', require: { read: Math.max(1, Math.min(3600, parseInt(g.read_secs,10)||10)) } };
    } else if (gate.type === 'stats' && gate.require && gate.require.read == null && g.read_secs) {
      gate.require.read = Math.max(1, Math.min(3600, parseInt(g.read_secs,10)||10));
    } else if (gate.type === 'stats' && (!gate.require || Object.keys(gate.require).length===0)) {
      gate.require = { read: Math.max(1, Math.min(3600, parseInt(g.read_secs,10)||10)) };
    }
    if (gateHash(gate) !== t.gh) { send(res, 403, { error: 'gate changed' }); return; }
    const resList = Array.isArray(g.res) ? g.res : [];
    if (resList.indexOf(t.res) < 0) { send(res, 400, { error: 'res invalid' }); return; }
    const host = {};
    for (const r of resList) {
      try {
        const u = resolveJarUrl(g.jar, r, g.id);
        host[r] = u ? new URL(u).hostname.toLowerCase() : null;
      } catch { host[r] = null; }
    }
    send(res, 200, {
      game: { id: g.id, name: g.name, res: resList, thumb: g.thumb || '', gate: gate || { type: 'none' } },
      res: t.res,
      host,
    });
  } catch (e) { try { console.error('meta error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
