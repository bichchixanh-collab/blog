/* sb-board.js — leaderboard + hồ sơ hiển thị.
   Cần bảng profiles + hàm RPC get_board (SQL trong chat). */
(function () {
'use strict';
function base() { return (window.SB_URL || '').replace(/\/$/, ''); }
function key() { return window.SB_KEY || ''; }
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
  async board() {
    const r = await fetch(base() + '/rest/v1/rpc/get_board', {
      method: 'POST', headers: { apikey: key(), 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('board lỗi ' + r.status);
    return r.json();
  }
};
})();
