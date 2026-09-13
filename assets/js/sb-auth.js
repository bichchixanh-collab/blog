/* sb-auth.js — Supabase Auth nấc 1 bằng REST thuần (không tải lib ngoài, hợp CSP).
   Đăng ký / đăng nhập email+pass / link ma thuật / đăng xuất / giữ session localStorage.
   Dùng chung cho mọi trang qua window.SBAuth. */
(function () {
'use strict';
var LS = 'sb_session';
function cfg() { return { url: window.SB_URL || '', key: window.SB_KEY || '' }; }
function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
function save(s) { try { if (s) localStorage.setItem(LS, JSON.stringify(s)); else localStorage.removeItem(LS); } catch (e) {} }
function headers(json) {
  var h = { apikey: cfg().key };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
async function call(path, opts) {
  const c = cfg();
  if (!c.url || !c.key) throw new Error('Chưa cấu hình Supabase (sb-config.js).');
  const r = await fetch(c.url + path, opts);
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description)) || ('Lỗi ' + r.status));
  return j;
}
function normSession(j) {
  if (!j) return null;
  if (j.session) j = j.session;
  if (!j.access_token) return null;
  return { access_token: j.access_token, refresh_token: j.refresh_token || '', user: j.user || null, exp: Date.now() + ((j.expires_in || 3600) * 1000) };
}
async function refresh() {
  const s = load();
  if (!s || !s.refresh_token) return null;
  try {
    const j = await call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: headers(true),
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    const n = normSession(j);
    if (n) { if (!n.user) n.user = s.user; save(n); return n; }
  } catch (e) { save(null); }
  return null;
}
async function session() {
  let s = load();
  if (s && s.exp - Date.now() > 60000) return s;
  return refresh();
}
async function me() {
  const s = await session();
  if (!s) return null;
  try {
    const r = await fetch(cfg().url + '/auth/v1/user', {
      headers: Object.assign(headers(false), { Authorization: 'Bearer ' + s.access_token })
    });
    if (r.status === 401) { save(null); return null; }
    if (!r.ok) return s.user;
    return await r.json();
  } catch (e) { return s.user; }
}
window.SBAuth = {
  async signUp(email, pass) {
    const j = await call('/auth/v1/signup', {
      method: 'POST', headers: headers(true),
      body: JSON.stringify({ email: email, password: pass })
    });
    // Confirm email OFF → trả session luôn; ON → trả user, chờ bấm link mail.
    const n = normSession(j);
    if (n) { if (!n.user && j.user) n.user = j.user; save(n); return { user: n.user, session: true }; }
    return { user: (j && j.user) || null, session: false };
  },
  async signIn(email, pass) {
    const j = await call('/auth/v1/token?grant_type=password', {
      method: 'POST', headers: headers(true),
      body: JSON.stringify({ email: email, password: pass })
    });
    const n = normSession(j);
    if (!n) throw new Error('Không tạo được phiên.');
    save(n);
    return n.user;
  },
  async magic(email) {
    await call('/auth/v1/otp', {
      method: 'POST', headers: headers(true),
      body: JSON.stringify({ email: email })
    });
    return true;
  },
  async signOut() {
    const s = load();
    try {
      if (s) await fetch(cfg().url + '/auth/v1/logout', {
        method: 'POST', headers: Object.assign(headers(false), { Authorization: 'Bearer ' + s.access_token })
      });
    } catch (e) {}
    save(null);
  },
  session: session,
  me: me,
  // Magic link quay về web kèm #access_token=... → gọi 1 lần khi trang load để lưu session.
  async fromUrl() {
    try {
      if (!location.hash || location.hash.indexOf('access_token') < 0) return null;
      const p = new URLSearchParams(location.hash.slice(1));
      const at = p.get('access_token'), rt = p.get('refresh_token'), ex = +(p.get('expires_in') || 3600);
      if (!at) return null;
      const n = { access_token: at, refresh_token: rt || '', user: null, exp: Date.now() + ex * 1000 };
      save(n);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      n.user = await me();
      save(n);
      return n;
    } catch (e) { return null; }
  }
};
})();
