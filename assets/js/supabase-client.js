// assets/js/supabase-client.js — Thay thế localStorage bằng Supabase API
// Dùng chung cho client (Bearer token) — lưu localStorage làm cache offline

const SB_URL = 'https://pmotbltodyyilarnvtpn.supabase.co';
const SB_KEY = 'sb_publishable_-Fz1GZfWaPSnH0nJ231vxQ_aqWd6cop'; // anon key
const supabase = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true } });

// Cache localStorage key prefix
const LS_PREFIX = 'sb_cache_';

// Helpers
function getToken() {
  try {
    const s = JSON.parse(localStorage.getItem('sb_session') || 'null');
    return s?.access_token || '';
  } catch { return ''; }
}

function getHeaders() {
  const token = getToken();
  return {
    apikey: 'sb_publishable_-Fz1GZfWaPSnH0nJ231vxQ_aqWd6cop',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function cacheKey(table) { return LS_PREFIX + table; }

function getCache(table) {
  try { return JSON.parse(localStorage.getItem(cacheKey(table)) || 'null'); } catch { return null; }
}

function setCache(table, data) {
  try { localStorage.setItem(cacheKey(table), JSON.stringify(data)); } catch {}
}

function clearCache(table) { localStorage.removeItem(cacheKey(table)); }

// --- API calls ---
async function sbRequest(table, method, data = null, id = null) {
  const url = `https://pmotbltodyyilarnvtpn.supabase.co/rest/v1/${table}${id ? `?id=eq.${id}` : ''}`;
  const opts = {
    method: method,
    headers: {
      apikey: 'sb_publishable_-Fz1GZfWaPSnH0nJ231vxQ_aqWd6cop',
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(`https://pmotbltodyyilarnvtpn.supabase.co/rest/v1/${table}${id ? `?id=eq.${id}` : ''}`, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt}`);
  }
  return res.json();
}

// --- PET ---
async function getPet() {
  const cached = getCache('user_pets');
  if (cached) return cached;
  const data = await sbRequest('user_pets', 'GET');
  if (data) { setCache('user_pets', data); return data; }
  return {};
}

async function updatePet(data) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase
    .from('user_pets')
    .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (data) { setCache('user_pets', data); return data; }
  throw new Error('Update pet failed');
}

// --- BINGO ---
async function getBingo() {
  const cached = getCache('user_bingo');
  if (cached) return cached;
  const data = await sbRequest('user_bingo', 'GET');
  if (data) { setCache('user_bingo', data); return data; }
  return [];
}

async function markBingoCell(actionId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const weekKey = getWeekKey();
  // Đọc hiện tại
  const { data: existing } = await supabase
    .from('user_bingo')
    .select('cells_done')
    .eq('user_id', userId)
    .eq('week_key', getWeekKey())
    .single();

  const cells = existing?.cells_done || {};
  cells[actionId] = 1;

  const { data, error } = await supabase
    .from('user_bingo')
    .upsert({ user_id: userId, week_key: getWeekKey(), cells_done: { [actionId]: 1 }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week_key' })
    .select()
    .single();

  if (data) { clearCache('user_bingo'); return data; }
  throw new Error('Mark bingo failed');
}

function getWeekKey() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const f = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fd = (f.getUTCDay() + 6) % 7;
  f.setUTCDate(f.getUTCDate() - fd + 3);
  const w = 1 + Math.round((d - f) / 6048e5);
  return d.getUTCFullYear() + '-W' + ('0' + w).slice(-2);
}

// --- GACHA ---
async function getGacha() {
  const cached = getCache('user_gacha');
  if (cached) return cached;
  const data = await sbRequest('user_gacha', 'GET');
  if (data) { setCache('user_gacha', data); return data; }
  return { pity: 0, theme: 'hong', badges: [], theme_unlock: ['hong'], last_spin_date: null };
}

// --- XP ---
async function getXp() {
  const cached = getCache('user_xp');
  if (cached) return cached;
  const data = await sbRequest('user_xp', 'GET');
  if (data) { setCache('user_xp', data); return data; }
  return { xp: 0, level: 1, total_xp: 0 };
}

async function addXp(amount) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const current = await getXp();
  const newXp = (current.xp || 0) + amount;
  const newLevel = Math.floor(newXp / 100) + 1;

  const { data, error } = await supabase
    .from('user_xp')
    .upsert({ user_id: (await supabase.auth.getUser()).data.user.id, xp: newXp, level: newLevel, total_xp: newXp, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();

  if (data) { setCache('user_xp', data); return data; }
  throw new Error('Add XP failed');
}

// --- FAVORITES ---
async function getFavorites() {
  const cached = getCache('user_favorites');
  if (cached) return cached;
  const data = await sbRequest('user_favorites', 'GET');
  if (data) { setCache('user_favorites', data); return data; }
  return [];
}

async function toggleFavorite(gameId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const favs = await getFavorites();
  const exists = favs.some(f => f.game_id === gameId);

  if (exists) {
    // Xóa
    await supabase.from('user_favorites').delete().eq('user_id', userId).eq('game_id', gameId);
    clearCache('user_favorites');
    return { added: false };
  } else {
    // Thêm
    const { data, error } = await supabase
      .from('user_favorites')
      .insert({ user_id: userId, game_id: gameId })
      .select()
      .single();
    if (data) { clearCache('user_favorites'); return { added: true }; }
    throw new Error('Add favorite failed');
  }
}

// --- COMPLETED ---
async function getCompleted() {
  const cached = getCache('user_completed');
  if (cached) return cached;
  const data = await sbRequest('user_completed', 'GET');
  if (data) { setCache('user_completed', data); return data; }
  return [];
}

async function toggleCompleted(gameId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const completed = await getCompleted();
  const exists = completed.some(c => c.game_id === gameId);

  if (exists) {
    await supabase.from('user_completed').delete().eq('user_id', userId).eq('game_id', gameId);
    clearCache('user_completed');
    return { added: false };
  } else {
    const { data, error } = await supabase
      .from('user_completed')
      .insert({ user_id: userId, game_id: gameId })
      .select()
      .single();
    if (data) { clearCache('user_completed'); return { added: true }; }
    throw new Error('Add completed failed');
  }
}

// --- SEEN ---
async function getSeen() {
  const cached = getCache('user_seen');
  if (cached) return cached;
  const data = await sbRequest('user_seen', 'GET');
  if (data) { setCache('user_seen', data); return data; }
  return [];
}

async function markSeen(gameId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const seen = await getSeen();
  if (seen.some(s => s.game_id === gameId)) return;

  await supabase.from('user_seen').insert({ user_id: userId, game_id: gameId });
  clearCache('user_seen');
}

// --- INVENTORY ---
async function getInventory() {
  const cached = getCache('user_inventory');
  if (cached) return cached;
  const data = await sbRequest('user_inventory', 'GET');
  if (data) { setCache('user_inventory', data); return data; }
  return { food: 0, items: {} };
}

async function updateInventory(data) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase
    .from('user_inventory')
    .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (data) { setCache('user_inventory', data); return data; }
  throw new Error('Update inventory failed');
}

// --- FAVORITES / COMPLETED / SEEN (generic) ---
async function toggleItem(table, gameId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data: existing } = await supabase.from(table).select('*').eq('user_id', userId).eq('game_id', gameId).single();

  if (existing) {
    await supabase.from(table).delete().eq('user_id', userId).eq('game_id', gameId);
    return { added: false };
  } else {
    const { data, error } = await supabase.from(table).insert({ user_id: userId, game_id: gameId }).select().single();
    if (error) throw error;
    return { added: true };
  }
}

// Export
window.SupabaseClient = {
  // Pet
  getPet, updatePet,
  // Bingo
  getBingo, markBingoCell,
  // Gacha
  getGacha,
  // XP
  getXp, addXp,
  // Favorites
  getFavorites, toggleFavorite,
  // Completed
  getCompleted, toggleCompleted,
  // Seen
  getSeen, markSeen,
  // Inventory
  getInventory, updateInventory,
  // Generic
  toggleItem: (table, gameId) => toggleItem(table, gameId),
  // Cache
  getCache, setCache, clearCache
};

// Auto-sync localStorage cũ lên Supabase (chạy 1 lần)
async function migrateLocalStorageToSupabase() {
  // Pet
  try {
    const s = JSON.parse(localStorage.getItem('j2me_senpai') || 'null');
    if (s?.pet) {
      await supabase.from('user_pets').upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        exp: s.pet.exp || 0,
        stage: s.pet.stage || 0,
        fun: s.pet.fun || 100,
        hunger: s.pet.hunger || 100,
        born_at: s.pet.born ? new Date(s.pet.born).toISOString() : new Date().toISOString(),
        last_tick_at: s.pet.lastTick ? new Date(s.pet.lastTick).toISOString() : new Date().toISOString(),
        act: s.pet.act || { feed:0, play:0, spin:0, adv:0, win:0, fav:0, share:0, comment:0, mail:0, battle:0, theme:0 }
      }, { onConflict: 'user_id' });
    }
    if (s?.gacha) {
      await supabase.from('user_gacha').upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        pity: s.gacha.pity || 0,
        theme: s.gacha.theme || 'hong',
        badges: s.gacha.badges || [],
        theme_unlock: s.gacha.themeUnlock || ['hong'],
        last_spin_date: s.gacha.lastSpin || null
      }, { onConflict: 'user_id' });
    }
    if (s?.stats) {
      await supabase.from('user_stats').upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        wins: s.stats.wins || 0,
        spins: s.stats.spins || 0,
        battles: s.stats.battles || 0
      }, { onConflict: 'user_id' });
    }
    if (s?.skills) {
      await supabase.from('user_pet_skills').upsert(
        s.skills.map(skill => ({ user_id: (await supabase.auth.getUser()).data.user?.id, skill })),
        { onConflict: 'user_id,skill' }
      );
    }
    if (s?.themeUnlock) {
      await supabase.from('user_theme_unlocks').upsert(
        s.themeUnlock.map(theme => ({ user_id: (await supabase.auth.getUser()).data.user?.id, theme })),
        { onConflict: 'user_id,theme' }
      );
    }
  } catch (e) { console.warn('Migrate senpai failed:', e); }

  // XP
  try {
    const xp = JSON.parse(localStorage.getItem('j2me_xp') || '{"xp":0}').xp || 0;
    await supabase.from('user_xp').upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      xp, level: Math.floor(xp/100)+1, total_xp: xp
    }, { onConflict: 'user_id' });
  } catch (e) { console.warn('Migrate xp failed:', e); }

  // Favorites
  try {
    const favs = JSON.parse(localStorage.getItem('j2me_favs') || '[]');
    for (const g of favs) {
      await supabase.from('user_favorites').upsert({ user_id: (await supabase.auth.getUser()).data.user?.id, game_id: g }, { onConflict: 'user_id,game_id' });
    }
  } catch (e) { console.warn('Migrate favs failed:', e); }

  // Completed
  try {
    const done = JSON.parse(localStorage.getItem('j2me_done') || '[]');
    for (const g of done) {
      await supabase.from('user_completed').upsert({ user_id: (await supabase.auth.getUser()).data.user?.id, game_id: g }, { onConflict: 'user_id,game_id' });
    }
  } catch (e) { console.warn('Migrate done failed:', e); }

  // Seen
  try {
    const seen = JSON.parse(localStorage.getItem('j2me_seen') || '[]');
    for (const g of seen) {
      await supabase.from('user_seen').upsert({ user_id: (await supabase.auth.getUser()).data.user?.id, game_id: g }, { onConflict: 'user_id,game_id' });
    }
  } catch (e) { console.warn('Migrate seen failed:', e); }

  // Bingo
  try {
    const bingo = JSON.parse(localStorage.getItem('j2me_bingo_prog') || '{}');
    for (const [week, cells] of Object.entries(bingo)) {
      await supabase.from('user_bingo').upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        week_key: week,
        cells_done: cells,
        claimed: []
      }, { onConflict: 'user_id,week_key' });
    }
  } catch (e) { console.warn('Migrate bingo failed:', e); }

  // Bingo claim
  try {
    const claims = JSON.parse(localStorage.getItem('j2me_bingo_claim') || '{}');
    for (const [week, lines] of Object.entries(claims)) {
      await supabase.from('user_bingo').update({ claimed: lines }).eq('user_id', (await supabase.auth.getUser()).data.user?.id).eq('week_key', week);
    }
  } catch (e) { console.warn('Migrate bingo claim failed:', e); }

  console.log('✅ Migration hoàn tất!');
}

// Auto-run khi load (chỉ chạy 1 lần)
if (!localStorage.getItem('sb_migrated')) {
  migrateLocalStorageToSupabase().then(() => localStorage.setItem('sb_migrated', '1'));
}

window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase;