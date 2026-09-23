/* sb-sync.js — đồng bộ XP + dữ liệu tài khoản lên Supabase (nấc 2).
   Bảng public.senpai(user_id, xp, data, updated_at), RLS: mỗi người chỉ thấy hàng của mình.
   Chiến lược merge đơn giản, an toàn: xp lấy max 2 bên; blob data lấy bản mới hơn
   (theo updated_at). Không có xung đột kiểu mất tài khoản như JSON-auth. */
(function () {
'use strict';
var LS_PUSH = 'sb_pushed_at';
function base() { return (window.SB_URL || '').replace(/\/$/, ''); }
function key() { return window.SB_KEY || ''; }
async function token() {
  try {
    const s = await window.SBAuth.session();
    return s ? s.access_token : null;
  } catch (e) { return null; }
}
function localXp() {
  try { return (JSON.parse(localStorage.getItem('j2me_xp') || '{"xp":0}').xp) || 0; } catch (e) { return 0; }
}
function setLocalXp(n) {
  try { localStorage.setItem('j2me_xp', JSON.stringify({ xp: n })); } catch (e) {}
}
function localData() {
  try { return JSON.parse(localStorage.getItem('j2me_senpai') || 'null'); } catch (e) { return null; }
}
function apiRoot() {
  try {
    var p = location.pathname || '/';
    var gi = p.indexOf('/game/');
    return gi >= 0 ? p.slice(0, gi) : '';
  } catch (e) { return ''; }
}
async function pullViaApi(t) {
  try {
    var r = await fetch(apiRoot() + '/api/user-data', { headers: { Authorization: 'Bearer ' + t }, cache: 'no-store' });
    if (!r.ok) return null;
    var j = await r.json();
    if (j && j.senpai) return { xp: j.senpai.xp || 0, data: j.senpai.data || null, updated_at: j.senpai.updated_at || '' };
    return null;
  } catch (e) { return null; }
}
async function pushViaApi(t, xp, data) {
  try {
    var r = await fetch(apiRoot() + '/api/user-data', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp: xp, data: data || {} }),
    });
    return r.ok;
  } catch (e) { return false; }
}
async function pull() {
  const t = await token();
  if (!t) throw new Error('Chưa đăng nhập.');
  const r = await fetch(base() + '/rest/v1/senpai?select=xp,data,updated_at', {
    headers: { apikey: key(), Authorization: 'Bearer ' + t, Accept: 'application/vnd.pgrst.object+json' }
  });
  if (r.status === 406) return null; // chưa có hàng nào
  if (!r.ok) throw new Error('Pull lỗi ' + r.status);
  return r.json();
}
async function push(xp, data) {
  const t = await token();
  if (!t) throw new Error('Chưa đăng nhập.');
  let uid = null;
  try { const u = await window.SBAuth.me(); uid = u && u.id; } catch (e) {}
  if (!uid) throw new Error('Không lấy được user id.');
  const r = await fetch(base() + '/rest/v1/senpai', {
    method: 'POST',
    headers: {
      apikey: key(), Authorization: 'Bearer ' + t,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ user_id: uid, xp: xp, data: data || {}, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('Push lỗi ' + r.status);
  try { localStorage.setItem(LS_PUSH, String(Date.now())); } catch (e) {}
  return true;
}
let timer = null;
window.SBSync = {
  // Đẩy nền, gom 15s/lần — gọi khi XP/dữ liệu đổi, không chặn UI.
  // Khi đã đăng nhập, Supabase là nguồn chính; local chỉ là cache.
  schedule() {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        const s = await window.SBAuth.session();
        if (!s) return;
        try { await push(localXp(), localData()); }
        catch (e) {
          var t = await token();
          if (t) await pushViaApi(t, localXp(), localData()).catch(function () {});
        }
      } catch (e) {}
    }, 15000);
  },
  // Đồng bộ đầy đủ 2 chiều, dùng khi mở trang đăng nhập / bấm nút.
  // Ưu tiên Supabase là nguồn chính; localStorage chỉ là cache offline.
  async syncNow() {
    var t = await token().catch(function () { return null; });
    var rem = await pull().catch(function () { return null; });
    if (!rem && t) rem = await pullViaApi(t);
    let xp = localXp(), data = localData();
    if (rem) {
      xp = Math.max(xp, rem.xp || 0);
      const rt = Date.parse(rem.updated_at || '') || 0;
      let lt = 0;
      try { lt = +(localStorage.getItem(LS_PUSH) || 0); } catch (e) {}
      if (rt > lt && rem.data) data = rem.data;
      setLocalXp(xp);
      try { if (data) localStorage.setItem('j2me_senpai', JSON.stringify(data)); } catch (e) {}
      // Đồng bộ favs/done/seen từ local lên server lần đầu (migration)
      try {
        var favs = JSON.parse(localStorage.getItem('j2me_favs') || '[]');
        var done = JSON.parse(localStorage.getItem('j2me_done') || '[]');
        if ((Array.isArray(favs) && favs.length) || (Array.isArray(done) && done.length)) {
          if (data) {
            data._favs = (data._favs || []).concat(favs).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 500);
            data._done = (data._done || []).concat(done).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 500);
          }
        }
      } catch (e) {}
    }
    setLocalXp(xp);
    var pushed = false;
    try { await push(xp, data); pushed = true; } catch (e) {
      if (t) pushed = await pushViaApi(t, xp, data);
    }
    if (!pushed && t) await pushViaApi(t, xp, data).catch(function () {});
    return { xp: xp, fromCloud: !!(rem && rem.data) };
  }
};
// Tự động đồng bộ khi đã đăng nhập — Supabase là nguồn chính, local chỉ là cache offline.
// Chạy nền sau khi trang load, không chặn UI.
try {
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      window.SBAuth.session().then(function (s) {
        if (s && s.access_token) window.SBSync.syncNow().catch(function () {});
      }).catch(function () {});
    }, 2000);
  });
} catch (e) {}
})();
