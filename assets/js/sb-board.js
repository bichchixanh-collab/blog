/* sb-board.js — leaderboard + vote chống clone (nấc 3).
   Chống clone bằng UNIQUE(user_id, game_id) trong DB + RLS — server ép luật,
   không phải localStorage. Cần bảng profiles, votes + 2 hàm RPC (SQL trong chat).
   Chưa đăng nhập → ném lỗi, caller tự rớt về luồng ẩn danh cũ. */
(function () {
'use strict';
function base() { return (window.SB_URL || '').replace(/\/$/, ''); }
function key() { return window.SB_KEY || ''; }
function validGame(id) { return /^[a-z0-9][a-z0-9\-]{0,119}$/i.test(String(id || '')); }
async function tok() {
  try { const s = await window.SBAuth.session(); return s ? s.access_token : null; } catch (e) { return null; }
}
async function meId() {
  try { const u = await window.SBAuth.me(); return u && u.id; } catch (e) { return null; }
}
window.SBBoard = {
  // Tạo hồ sơ hiển thị (giữ tên cũ nếu có) — gọi 1 lần sau đăng nhập.
  async ensureProfile() {
    const uid = await meId();
    const t = await tok();
    if (!uid || !t) return false;
    let name = 'senpai';
    try {
      const u = await window.SBAuth.me();
      name = String((u && u.email) || 'senpai').split('@')[0].slice(0, 20) || 'senpai';
    } catch (e) {}
    const r = await fetch(base() + '/rest/v1/profiles', {
      method: 'POST',
      headers: { apikey: key(), Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: uid, display_name: name })
    });
    return r.ok;
  },
  // Vote đã xác thực: DB ép 1 user 1 vote/game (upsert đổi ý được, không phình số).
  async vote(gameId, kind) {
    if (!validGame(gameId)) throw new Error('game invalid');
    if (['love', 'ok', 'sad'].indexOf(kind) < 0) throw new Error('kind invalid');
    const t = await tok();
    if (!t) throw new Error('Chưa đăng nhập.');
    const uid = await meId();
    if (!uid) throw new Error('Chưa đăng nhập.');
    const r = await fetch(base() + '/rest/v1/votes', {
      method: 'POST',
      headers: { apikey: key(), Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: uid, game_id: gameId, kind: kind })
    });
    if (!r.ok) throw new Error('Vote lỗi ' + r.status);
    try { localStorage.setItem('react_' + gameId, kind); } catch (e) {}
    return true;
  },
  async mine(gameId) {
    const t = await tok();
    if (!t) return null;
    try {
      const r = await fetch(base() + '/rest/v1/votes?game_id=eq.' + encodeURIComponent(gameId) + '&select=kind', {
        headers: { apikey: key(), Authorization: 'Bearer ' + t, Accept: 'application/vnd.pgrst.object+json' }
      });
      if (r.status === 406 || !r.ok) return null;
      const j = await r.json();
      return (j && j.kind) || null;
    } catch (e) { return null; }
  },
  async countsFor(gameId) {
    const m = await this.countsAll();
    return m[gameId] || { love: 0, ok: 0, sad: 0 };
  },
  async countsAll() {
    const r = await fetch(base() + '/rest/v1/rpc/get_vote_counts', {
      method: 'POST', headers: { apikey: key(), 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('counts lỗi ' + r.status);
    const rows = await r.json();
    const m = {};
    (rows || []).forEach(function (x) {
      if (!m[x.game_id]) m[x.game_id] = { love: 0, ok: 0, sad: 0 };
      if (m[x.game_id][x.kind] != null) m[x.game_id][x.kind] = x.n;
    });
    return m;
  },
  async board() {
    const r = await fetch(base() + '/rest/v1/rpc/get_board', {
      method: 'POST', headers: { apikey: key(), 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('board lỗi ' + r.status);
    return r.json();
  }
};
})();
