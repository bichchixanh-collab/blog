/* senpai.js — Góc Senpai: gacha máy gắp + pet + phiêu lưu offline + đấu bot.
   Chạy độc lập trên goc-senpai.html, không đụng trang cũ. Lưu localStorage key j2me_senpai.
   XP cộng dồn vào key j2me_xp sẵn có để profile hiện tại tự nhận. */
(function () {
'use strict';
var DAY = 864e5;
var $ = function (id) { return document.getElementById(id); };
function today() { return new Date().toISOString().slice(0, 10); }
function now() { return Date.now(); }

// ---------- state ----------
function blank() {
  return {
    pet: { stage: 0, exp: 0, hunger: 70, fun: 70, born: now(), lastTick: now(), act: { feed: 0, play: 0, spin: 0 } },
    gacha: { lastSpin: '', pity: 0, theme: 'hong', badges: [] },
    inv: { food: 1 },
    adv: { start: 0, dur: 0, claimed: true },
    skills: [],
    stats: { spins: 0, wins: 0, battles: 0 },
    themeUnlock: ['hong']
  };
}
function load() {
  try { var s = JSON.parse(localStorage.getItem('j2me_senpai') || 'null'); if (s && s.pet) return s; } catch (e) {}
  return blank();
}
var S = load();
function save() { try { localStorage.setItem('j2me_senpai', JSON.stringify(S)); } catch (e) {} try { if (window.SBSync) window.SBSync.schedule(); } catch (e) {} }
function addXp(n) {
  try {
    var o = JSON.parse(localStorage.getItem('j2me_xp') || '{"xp":0}');
    o.xp = (o.xp || 0) + n;
    localStorage.setItem('j2me_xp', JSON.stringify(o));
  } catch (e) {}
}
function seenCount() { try { var a = JSON.parse(localStorage.getItem('j2me_seen') || '[]'); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } }
function petTitle() {
  var evo = S.pet.evo ? EVOS.filter(function (x) { return x.id === S.pet.evo; })[0] : null;
  return evo ? evo.name : STAGES[Math.min(S.pet.stage, 3)].name;
}

// ---------- bingo tuần (bảng giống nhau cho mọi người trong tuần) ----------
var BINGO_ALL = [
  { id: 'open_vi', emo: '🇻🇳', label: 'Mở game Việt Hóa' },
  { id: 'spin', emo: '🎰', label: 'Quay gacha' },
  { id: 'feed', emo: '🍙', label: 'Cho pet ăn' },
  { id: 'play', emo: '🎾', label: 'Chơi với pet' },
  { id: 'adv', emo: '🎒', label: 'Nhận quà phiêu lưu' },
  { id: 'win', emo: '⚔️', label: 'Thắng bot' },
  { id: 'fav', emo: '♡', label: 'Thích 1 game' },
  { id: 'share', emo: '🔗', label: 'Chia sẻ link' },
  { id: 'comment', emo: '💬', label: 'Bình luận' },
  { id: 'mail', emo: '✉️', label: 'Mở thư sáng' },
  { id: 'battle', emo: '🥊', label: 'Đấu 1 trận' },
  { id: 'theme', emo: '🎨', label: 'Đổi theme' }
];
var BINGO_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function bingoWeek(d) {
  d = d || new Date();
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  var first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  var fday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - fday + 3);
  var w = 1 + Math.round((t - first) / 6048e5);
  return t.getUTCFullYear() + '-W' + ('0' + w).slice(-2);
}
function bhash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function bingoBoard() {
  var w = bingoWeek(), seed = bhash(w), out = [], pool = BINGO_ALL.slice();
  var rnd = function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  while (out.length < 9 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return { week: w, cells: out };
}
function bprog() { try { return JSON.parse(localStorage.getItem('j2me_bingo_prog') || '{}'); } catch (e) { return {}; } }
function bmark(a) {
  try {
    var w = bingoWeek(), k = 'j2me_bingo_prog', o = JSON.parse(localStorage.getItem(k) || '{}');
    if (!o[w]) o[w] = {};
    if (!o[w][a]) { o[w][a] = 1; localStorage.setItem(k, JSON.stringify(o)); }
  } catch (e) {}
}
function bIsDone(board, idx) {
  var id = board.cells[idx].id, p = (bprog()[board.week] || {});
  if (p[id]) return true;
  if (id === 'fav') { try { var f = JSON.parse(localStorage.getItem('j2me_favs') || '[]'); if (f.length) return true; } catch (e) {} }
  return false;
}
function bLines(board) {
  var done = [], i, L;
  for (i = 0; i < BINGO_LINES.length; i++) { L = BINGO_LINES[i]; if (bIsDone(board, L[0]) && bIsDone(board, L[1]) && bIsDone(board, L[2])) done.push(i); }
  return done;
}
function bLinesCount() { try { return bLines(bingoBoard()).length; } catch (e) { return 0; } }
function bClaimed() { try { var o = JSON.parse(localStorage.getItem('j2me_bingo_claim') || '{}'); return o[bingoWeek()] || []; } catch (e) { return []; } }
function bingoClaim() {
  var b = bingoBoard(), done = bLines(b);
  var fresh = done.filter(function (i) { return bClaimed().indexOf(i) < 0; });
  if (!fresh.length) return msg('Chưa có line mới — làm nhiệm vụ các ô bingo đã!');
  addXp(30 * fresh.length);
  try { var o = JSON.parse(localStorage.getItem('j2me_bingo_claim') || '{}'); o[b.week] = bClaimed().concat(fresh); localStorage.setItem('j2me_bingo_claim', JSON.stringify(o)); } catch (e) {}
  var extra = '';
  if (done.length >= 8) {
    try { var o2 = JSON.parse(localStorage.getItem('j2me_bingo_claim') || '{}'); if (o2[b.week].indexOf(99) < 0) { o2[b.week] = o2[b.week].concat([99]); localStorage.setItem('j2me_bingo_claim', JSON.stringify(o2)); addXp(100); extra = ' + FULL HOUSE +100 XP'; } } catch (e) {}
  }
  save(); paint();
  msg('Bingo! +' + (30 * fresh.length) + ' XP (' + fresh.length + ' line)' + extra);
}

// ---------- hộp thư sáng (thư + quà deterministic theo ngày) ----------
var LETTERS = [
  { t: 'Chào buổi sáng!', b: '{pet} dậy rồi nè~ Hôm nay cũng chơi vui nha Senpai!', xp: 5 },
  { t: 'Tin nóng WAP', b: 'Nghe nói tối nay có game mới lên kệ đó. Nhớ ghé xem nha!', xp: 5 },
  { t: 'Bí kíp retro', b: 'Game Java ngày xưa lưu bằng RMS — tắt máy đột ngột là mất save đó. Nhớ save tay nha!', xp: 8 },
  { t: 'Pet thì thầm', b: '{pet} bảo mơ thấy Senpai cho ăn 10 cái đùi gà. Mơ đẹp ghê~', xp: 5 },
  { t: 'Thử thách hôm nay', b: 'Mở 1 game Việt Hóa bất kỳ để tick ô bingo 🇻🇳. Dễ ợt!', xp: 5 },
  { t: 'Chuyện màn hình', b: '240x320 là QVGA chuẩn của Nokia N73 đó Senpai. Máy bạn màn gì?', xp: 8 },
  { t: 'Quà bất ngờ', b: 'Không có gì đặc biệt, chỉ là {pet} nhớ bạn thôi. Quà nè!', xp: 10 },
  { t: 'Mẹo tải nhanh', b: 'Dùng Opera Mini tải JAR ít rớt hơn trình duyệt mặc định nhiều lắm!', xp: 8 },
  { t: 'Pet khoe', b: '{pet} vừa học được trò mới! Vào Góc Senpai chơi với nó đi~', xp: 5 },
  { t: 'Chuyện modder', b: 'Mấy bản Việt Hóa toàn công modder thâu đêm. Thấy hay thì bình luận cảm ơn họ nha!', xp: 8 },
  { t: 'Hôm nay hợp màu gì?', b: '{pet} bảo hôm nay hợp màu hồng. Đổi theme hồng cho hên nè!', xp: 5 },
  { t: 'Nhắc nhẹ', b: 'Pet đói rồi đó! Cho nó ăn rồi hẵng đi chơi nha 🍙', xp: 5 },
  { t: 'Chuyện xưa', b: 'Hồi 2010, 1 game 1MB tải mất cả buổi với GPRS. Giờ 1 giây xong. Sướng~', xp: 8 },
  { t: 'Phiêu lưu gọi', b: 'Gửi pet đi phiêu lưu 8 tiếng đi, tối về là có quà to!', xp: 5 },
  { t: 'Đố bạn', b: 'Phím nào để chụp màn hình trên Nokia S40? Trả lời trong lòng thôi, quà vẫn có!', xp: 8 },
  { t: 'Pet tâm sự', b: '{pet} hỏi khi nào Senpai cho nó ăn game mới. Nó thèm skill mới rồi!', xp: 5 },
  { t: 'Mẹo pin', b: 'Chơi game Java tốn pin lắm — giảm sáng màn hình để cày lâu hơn nha!', xp: 5 },
  { t: 'Chuyện đấu bot', b: 'Bot mạnh dần theo số trận thắng của bạn đó. Nuôi pet khỏe vào rồi hẵng đấu!', xp: 8 },
  { t: 'Quà cuối tuần?', b: 'Cuối tuần rảnh thì cày nốt mấy ô bingo còn lại nha. Line nào cũng +30 XP!', xp: 10 },
  { t: 'Bí mật', b: 'Nghe đồn đủ 7 ngày quay gacha liên tục thì ngày thứ 7 chắc chắn ra đồ hiếm. Thử đi!', xp: 8 }
];
function mailDay() { return today(); }
function mailState() { try { return JSON.parse(localStorage.getItem('j2me_mail') || '{}'); } catch (e) { return {}; } }
function mailPick() {
  var d = new Date(), start = new Date(d.getFullYear(), 0, 0);
  var doy = Math.floor((d - start) / 864e5);
  return LETTERS[doy % LETTERS.length];
}
function mailUnread() { return mailState().last !== mailDay(); }
function mailOpen() {
  var L = mailPick(), box = $('mailLetter');
  if (box) {
    box.style.display = '';
    box.innerHTML = '<b>💌 ' + L.t + '</b><p style="margin-top:6px">' + L.b.replace(/\{pet\}/g, petTitle()) + '</p>'
      + '<div class="rowbtns"><button class="btn" onclick="SEN.mailClaim()">Nhận quà</button></div>';
  }
}
function mailClaim() {
  if (!mailUnread()) return msg('Hôm nay nhận rồi~ mai quay lại nha ✉️');
  var m = mailState(), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  var streak = (m.last === y) ? (m.streak || 0) + 1 : 1;
  var xp = mailPick().xp + 5 + Math.min(streak * 2, 20);
  var food = streak % 3 === 0 ? 2 : 1;
  addXp(xp); S.inv.food += food;
  try { localStorage.setItem('j2me_mail', JSON.stringify({ last: mailDay(), streak: streak })); } catch (e) {}
  bmark('mail'); save(); paint();
  msg('Nhận thư +' + xp + ' XP, 🍙 ×' + food + ' (chuỗi ' + streak + ' ngày) ✉️');
}

// ---------- pet ----------
var STAGES = [
  { name: 'Trứng', emo: '🥚' }, { name: 'Pet con', emo: '🐣' },
  { name: 'Pet teen', emo: '🐥' }, { name: 'Pet trưởng thành', emo: '🦅' }
];
var EVOS = [
  { id: 'lua', name: 'Hỏa Senpai', emo: '🔥', hint: 'cho ăn nhiều' },
  { id: 'nuoc', name: 'Thủy Senpai', emo: '🌊', hint: 'chơi nhiều' },
  { id: 'sach', name: 'Học giả Senpai', emo: '🦉', hint: 'xem nhiều game' }
];
function petLevel() { return Math.floor(S.pet.exp / 100); }
function petView() {
  // decay theo thời gian thật
  var h = Math.max(0, (now() - S.pet.lastTick) / 36e5);
  if (h > 0.25) {
    S.pet.hunger = Math.max(0, S.pet.hunger - h * 4);
    S.pet.fun = Math.max(0, S.pet.fun - h * 3);
    S.pet.lastTick = now(); save();
  }
  var evo = S.pet.evo ? EVOS.filter(function (x) { return x.id === S.pet.evo; })[0] : null;
  var emo = evo ? evo.emo : STAGES[Math.min(S.pet.stage, 3)].emo;
  var mood = S.pet.hunger < 20 ? 'đói meo~ 🥺' : S.pet.fun < 20 ? 'buồn~ 🥺' : 'vui vẻ~ ✨';
  var hr = new Date().getHours();
  var note = (hr >= 0 && hr < 5) ? 'Senpai còn thức khuya sao? Pet buồn ngủ rồi~ 😴' : '';
  return { emo: emo, mood: mood, note: note, evo: evo };
}
function feed() {
  if (S.inv.food <= 0) return msg('Hết đồ ăn! Quay gacha để kiếm thêm 🍙');
  if (S.pet.hunger >= 100) return msg('Pet no căng rồi~');
  S.inv.food--; S.pet.hunger = Math.min(100, S.pet.hunger + 25);
  S.pet.exp += 8;   S.pet.act.feed++; try { bmark('feed'); } catch (e) {} S.pet.lastTick = now();
  checkStage(); save(); paint(); msg('Pet ăn ngon lành! +8 EXP 🍙');
}
function play() {
  var last = +(localStorage.getItem('j2me_play_cd') || 0);
  if (now() - last < 5 * 60e3) return msg('Pet đang mệt, 5 phút nữa chơi tiếp nha~');
  try { localStorage.setItem('j2me_play_cd', String(now())); } catch (e) {}
  S.pet.fun = Math.min(100, S.pet.fun + 20); S.pet.exp += 10;
  S.pet.act.play++; try { bmark('play'); } catch (e) {} S.pet.lastTick = now();
  checkStage(); save(); paint(); msg('Chơi vui quá! +10 EXP 🎾');
}
function checkStage() {
  var lv = petLevel();
  var ns = lv >= 12 ? 3 : lv >= 6 ? 2 : lv >= 2 ? 1 : 0;
  if (ns > S.pet.stage) { S.pet.stage = ns; msg('🎉 Pet tiến hóa: ' + STAGES[ns].name + '!'); }
  // tiến hóa đặc biệt ở trưởng thành theo hành vi
  if (S.pet.stage >= 3 && !S.pet.evo) {
    var a = S.pet.act;
    if (a.feed >= 30) S.pet.evo = 'lua';
    else if (a.play >= 30) S.pet.evo = 'nuoc';
    else if (seenCount() >= 20) S.pet.evo = 'sach';
    if (S.pet.evo) msg('🌟 Tiến hóa đặc biệt: ' + petView().evo.name + '!');
  }
}

// ---------- gacha máy gắp ----------
var POOL = [
  { k: 'xp10', t: 'xp', v: 10, label: '+10 XP', w: 35 },
  { k: 'food1', t: 'food', v: 1, label: '🍙 ×1', w: 30 },
  { k: 'xp25', t: 'xp', v: 25, label: '+25 XP', w: 15 },
  { k: 'food3', t: 'food', v: 3, label: '🍙 ×3', w: 10 },
  { k: 'xp50', t: 'xp', v: 50, label: '+50 XP', w: 6 },
  { k: 'badge', t: 'badge', v: 0, label: '🎖️ Huy hiệu hiếm', w: 3 },
  { k: 'theme', t: 'theme', v: 0, label: '🎨 Theme mới', w: 1 }
];
var THEMES = ['hong', 'bien', 'matcha'];
var BADGES = ['🎖️', '🏵️', '🎗️', '🥇'];
function canSpin() { return S.gacha.lastSpin !== today(); }
function roll() {
  var tot = 0, i, r;
  var pity = S.gacha.pity >= 6; // ngày thứ 7 chắc chắn hiếm
  for (i = 0; i < POOL.length; i++) tot += (pity && (POOL[i].t === 'badge' || POOL[i].t === 'theme')) ? POOL[i].w * 10 : POOL[i].w;
  r = Math.random() * tot;
  for (i = 0; i < POOL.length; i++) {
    var w = (pity && (POOL[i].t === 'badge' || POOL[i].t === 'theme')) ? POOL[i].w * 10 : POOL[i].w;
    r -= w; if (r <= 0) return POOL[i];
  }
  return POOL[0];
}
function grant(p) {
  var label = p.label;
  if (p.t === 'xp') addXp(p.v);
  else if (p.t === 'food') S.inv.food += p.v;
  else if (p.t === 'badge') {
    var b = BADGES[Math.floor(Math.random() * BADGES.length)] + ' ' + today();
    S.gacha.badges.push(b); label = b;
  } else if (p.t === 'theme') {
    var locked = THEMES.filter(function (t) { return S.themeUnlock.indexOf(t) < 0; });
    if (!locked.length) { addXp(50); label = '+50 XP (đã đủ theme)'; }
    else { var t = locked[Math.floor(Math.random() * locked.length)]; S.themeUnlock.push(t); label = '🎨 Theme ' + t; }
  }
  if (p.t === 'badge' || p.t === 'theme') S.gacha.pity = 0; else S.gacha.pity++;
  return label;
}
// máy gắp: càng di chuyển 1.2s rồi thả — trúng ô nào gần càng nhất (trình diễn), quà roll theo pity
var clawTimer = null, clawPos = 0, clawDir = 1;
function clawStart() {
  if (!canSpin()) return msg('Hôm nay quay rồi~ mai quay tiếp nha 🎰');
  if (clawTimer) return;
  var track = $('clawTrack');
  clawTimer = setInterval(function () {
    clawPos += clawDir * 8;
    if (clawPos > 264) { clawDir = -1; clawPos = 264; }
    if (clawPos < 0) { clawDir = 1; clawPos = 0; }
    if (track) track.style.transform = 'translateX(' + clawPos + 'px)';
    var btn = $('clawBtn'); if (btn) btn.textContent = '🕹️ THẢ CÀNG!';
  }, 50);
  var btn = $('clawBtn'); if (btn) btn.onclick = clawDrop;
  msg('Càng đang chạy… bấm THẢ để gắp!');
}
function clawDrop() {
  if (!clawTimer) return;
  clearInterval(clawTimer); clawTimer = null;
  var btn = $('clawBtn'); if (btn) { btn.textContent = '🎰 QUAY MIỄN PHÍ HÔM NAY'; btn.onclick = clawStart; }
  var p = roll();
  var label = grant(p);
  S.gacha.lastSpin = today(); S.pet.act.spin++;
  S.stats.spins++; try { bmark('spin'); } catch (e) {} save(); applyTheme(); paint();
  var win = $('clawWin');
  if (win) { win.style.display = ''; win.innerHTML = '<div style="font-size:44px">🎁</div><b>Gắp trúng: ' + label + '</b>'; }
  msg('Gắp trúng <b>' + label + '</b>!');
}

// ---------- phiêu lưu offline ----------
var ADVS = [{ h: 1, label: 'Dạo quanh WAP (1h)' }, { h: 4, label: 'Thám hiểm (4h)' }, { h: 8, label: 'Phiêu lưu xa (8h)' }];
function advStart(h) {
  if (!S.adv.claimed) return msg('Pet đang đi rồi, nhận quà trước đã~');
  S.adv = { start: now(), dur: h * 36e5, claimed: false };
  save(); paint(); msg('Pet lên đường! Quay lại sau ' + h + 'h để nhận quà 🎒');
}
function advStatus() {
  if (S.adv.claimed) return null;
  var left = S.adv.start + S.adv.dur - now();
  return left <= 0 ? 'done' : Math.ceil(left / 36e5) + 'h' + Math.ceil((left % 36e5) / 6e4) + 'p';
}
function advClaim() {
  var st = advStatus();
  if (st !== 'done') return msg('Chưa tới giờ! Pet vẫn đang đi~');
  var mult = S.adv.dur / 36e5;
  var xp = Math.round(15 * mult + petLevel() * 5);
  var food = 1 + Math.floor(mult / 2);
  addXp(xp); S.inv.food += food;
  S.adv.claimed = true; try { bmark('adv'); } catch (e) {} save(); paint();
  msg('Pet về rồi! Mang theo +' + xp + ' XP và 🍙 ×' + food);
}

// ---------- đấu bot + ăn game ----------
var SKILLMAP = { 'Hành Động': '💥', 'Nhập Vai': '🔮', 'Đua xe': '🏎️', 'Bắn súng': '🎯', 'Trí tuệ': '🧠', 'Thể thao': '⚽', 'Phiêu lưu': '🗺️', 'Nông trại': '🌾', 'Việt Hóa': '🇻🇳' };
function petPower() {
  return petLevel() * 10 + S.skills.length * 15 + Math.floor(S.pet.fun / 10);
}
function eatGame(id) {
  if (S.skills.length >= 3) return msg('Pet chỉ nhớ được 3 skill — đánh 1 trận để quên bớt? (hiện giữ nguyên)');
  var g = null;
  try {
    var all = JSON.parse(localStorage.getItem('j2me_games') || 'null');
    if (all && all.data) g = all.data.filter(function (x) { return x.id === id; })[0];
  } catch (e) {}
  if (!g) return msg('Chưa thấy game này trong máy~');
  var sk = SKILLMAP[g.cat] || '✨';
  if (S.skills.indexOf(sk) >= 0) return msg('Pet biết skill này rồi!');
  S.skills.push(sk); save(); paint();
  msg('Pet ăn game <b>' + g.name + '</b>, học skill ' + sk + '!');
}
function battle() {
  var pow = petPower();
  var foe = 20 + S.stats.wins * 12 + Math.floor(Math.random() * 20);
  S.stats.battles++; try { bmark('battle'); } catch (e) {}
  var out = $('battleOut');
  if (pow + Math.random() * 20 >= foe) {
    S.stats.wins++; try { bmark('win'); } catch (e) {}
    var rw = 10 + Math.floor(Math.random() * 20);
    addXp(rw); S.inv.food += 1; S.pet.exp += 15; checkStage();
    if (out) out.innerHTML = '🏆 <b>THẮNG!</b> Pet (' + pow + ') hạ bot (' + foe + ') +' + rw + ' XP, 🍙 ×1';
  } else if (out) out.innerHTML = '😅 <b>Thua rồi!</b> Pet (' + pow + ') vs bot (' + foe + ') — cho ăn + chơi để mạnh hơn nha';
  save(); paint();
}

// ---------- vẽ ----------
function msg(h) { var m = $('senMsg'); if (m) m.innerHTML = h; }
function applyTheme() {
  var t = S.gacha.theme || 'hong';
  try { document.body.setAttribute('data-theme', t); } catch (e) {}
  var sel = $('themeSel');
  if (sel) sel.innerHTML = S.themeUnlock.map(function (x) { return '<option value="' + x + '"' + (x === t ? ' selected' : '') + '>' + x + '</option>'; }).join('');
}
function paint() {
  var v = petView();
  if ($('petEmo')) $('petEmo').textContent = v.emo;
  if ($('petName')) $('petName').textContent = (v.evo ? v.evo.name : STAGES[Math.min(S.pet.stage, 3)].name) + ' • Lv' + petLevel();
  if ($('petMood')) $('petMood').textContent = v.mood;
  if ($('petNote')) { $('petNote').style.display = v.note ? '' : 'none'; $('petNote').textContent = v.note; }
  if ($('barNo')) $('barNo').style.width = S.pet.hunger + '%';
  if ($('barVui')) $('barVui').style.width = S.pet.fun + '%';
  if ($('foodN')) $('foodN').textContent = S.inv.food;
  if ($('expN')) $('expN').textContent = S.pet.exp + ' EXP';
  if ($('pityN')) $('pityN').textContent = S.gacha.pity >= 6 ? 'Lần tới CHẮC CHẮN hiếm!' : ('Bảo hiểm hiếm sau ' + (7 - S.gacha.pity) + ' ngày');
  if ($('spinBox')) $('spinBox').style.display = canSpin() ? '' : 'none';
  if ($('spunBox')) {
    $('spunBox').style.display = canSpin() ? 'none' : '';
    if (!canSpin()) $('spunBox').textContent = 'Đã quay hôm nay ✓ Mai quay tiếp nha!';
  }
  var st = advStatus();
  if ($('advBox')) {
    $('advBox').innerHTML = st === null
      ? ADVS.map(function (a, i) { return '<button class="btn ghost" onclick="SEN.advStart(' + a.h + ')">' + a.label + '</button>'; }).join('')
      : (st === 'done'
        ? '<p>🎒 Pet về rồi!</p><button class="btn" onclick="SEN.advClaim()">Nhận quà</button>'
        : '<p>Pet đang đi… về sau <b>' + st + '</b></p>');
  }
  if ($('skillRow')) $('skillRow').textContent = S.skills.length ? S.skills.join(' ') : 'chưa có — cho pet ăn game bên dưới';
  if ($('powN')) $('powN').textContent = petPower();
  if ($('statN')) $('statN').textContent = 'Quay ' + S.stats.spins + ' • Thắng ' + S.stats.wins + '/' + S.stats.battles;
  if ($('badgeRow')) $('badgeRow').textContent = S.gacha.badges.length ? S.gacha.badges.join(' ') : 'chưa có huy hiệu hiếm';
  paintBingo(); paintMail();
  paintEatList();
}
function paintBingo() {
  var box = $('bingoGrid'); if (!box) return;
  var b = bingoBoard();
  box.innerHTML = b.cells.map(function (c, i) {
    var d = bIsDone(b, i);
    return '<div style="background:' + (d ? '#e6f9ec' : '#fff') + ';border:1.5px solid ' + (d ? '#0a9c4a' : '#ffd0e8') + ';border-radius:10px;padding:8px 4px;text-align:center;font-size:10px;line-height:1.4">'
      + '<div style="font-size:20px">' + (d ? '✅' : c.emo) + '</div>' + c.label + '</div>';
  }).join('');
  var done = bLines(b).length;
  if ($('bingoInfo')) $('bingoInfo').textContent = 'Tuần ' + b.week + ' • xong ' + done + '/8 line • mỗi line +30 XP';
}
function paintMail() {
  var dot = $('mailDot'); if (dot) dot.style.display = mailUnread() ? '' : 'none';
  var st = $('mailStreak');
  if (st) { var m = mailState(); st.textContent = (m.streak && !mailUnread()) ? ('chuỗi ' + m.streak + ' ngày 🔥') : ''; }
}
function paintEatList() {
  var box = $('eatList'); if (!box) return;
  var all = null;
  try { var o = JSON.parse(localStorage.getItem('j2me_games') || 'null'); if (o && o.data) all = o.data.slice(0, 12); } catch (e) {}
  if (!all || !all.length) { box.innerHTML = '<small style="color:#8a6a7a">Mở trang chủ 1 lần để nạp danh sách game vào máy đã~</small>'; return; }
  box.innerHTML = all.map(function (g) {
    return '<button class="btn ghost" style="font-size:10px" onclick="SEN.eatGame(\'' + String(g.id).replace(/'/g, '') + '\')">' + String(g.name).slice(0, 12) + '</button>';
  }).join('');
}

// API cho onclick inline
window.SEN = { feed: feed, play: play, clawStart: clawStart, advStart: advStart, advClaim: advClaim, eatGame: eatGame, battle: battle,
  bingoClaim: bingoClaim, mailOpen: mailOpen, mailClaim: mailClaim,
  setTheme: function (t) { if (S.themeUnlock.indexOf(t) >= 0) { S.gacha.theme = t; try { bmark('theme'); } catch (e) {} save(); applyTheme(); } } };

document.addEventListener('DOMContentLoaded', function () {
  applyTheme(); paint();
  var ts = $('themeSel'); if (ts) ts.onchange = function () { window.SEN.setTheme(ts.value); };
  var cb = $('clawBtn'); if (cb) cb.onclick = clawStart;
  var bb = $('battleBtn'); if (bb) bb.onclick = battle;
  var fb = $('feedBtn'); if (fb) fb.onclick = feed;
  var pb = $('playBtn'); if (pb) pb.onclick = play;
});
})();
