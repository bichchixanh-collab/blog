/* sb-sync.js — đồng bộ pet/bingo/XP lên Supabase (nấc 2).
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
  // Đẩy nền, gom 15s/lần — gọi từ save() của senpai.js, không chặn UI.
  schedule() {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        const s = await window.SBAuth.session();
        if (!s) return;
        await push(localXp(), localData());
      } catch (e) {}
    }, 15000);
  },
  // Đồng bộ đầy đủ 2 chiều, dùng khi mở trang đăng nhập / bấm nút.
  async syncNow() {
    const rem = await pull().catch(() => null);
    let xp = localXp(), data = localData();
    if (rem) {
      xp = Math.max(xp, rem.xp || 0);
      const rt = Date.parse(rem.updated_at || '') || 0;
      let lt = 0;
      try { lt = +(localStorage.getItem(LS_PUSH) || 0); } catch (e) {}
      if (rt > lt && rem.data) data = rem.data;
      setLocalXp(xp);
      try { if (data) localStorage.setItem('j2me_senpai', JSON.stringify(data)); } catch (e) {}
    }
    setLocalXp(xp);
    await push(xp, data);
    return { xp: xp, fromCloud: !!(rem && rem.data) };
  }
};
})();
