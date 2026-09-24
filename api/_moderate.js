// api/_moderate.js — Combo: local (URL/sđt/spam) + admin file banned_words.json + OpenAI Moderation (nếu bật)
// Không hardcode từ cấm trong code nữa — toàn bộ đọc từ data/banned_words.json (quản lý trong admin.php)
// Nguồn list gốc: blue-eyes-vn/vietnamese-offensive-words (MIT, 2023 Blue Eyes) + từ bổ sung thủ công.

const fs = require('fs');
const path = require('path');

const URL_RE = /(https?:\/\/|www\.)|([a-z0-9-]+\.(com|net|org|info|xyz|top|click|shop|online|site|tech|store|me|cc|io|co|link|live|fun|pro|app|dev|icu|vip|art|blog|cloud|asia|biz|vn|com\.vn)\b)/i;
const PHONE_RE = /(\b0\d{9,10}\b|(\+84|84)[\s.-]?\d{8,10})/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

// Cấu hình kiểm duyệt (data/moderate_config.json) — admin bật/tắt trong admin.php,
// không cần động vào env Vercel. Key Perspective vẫn nằm ở env (bí mật, không lưu repo).
// Cache 30s
let _cfgCache = { at: 0, cfg: null };
function loadModerateConfig() {
  const now = Date.now();
  if (_cfgCache.cfg && now - _cfgCache.at < 30000) return _cfgCache.cfg;
  const defaults = { auto_approve: true, ai_enabled: false, threshold: 0.75 };
  const candidates = [
    path.join(process.cwd(), 'data', 'moderate_config.json'),
    path.join(process.cwd(), 'blog-v2', 'data', 'moderate_config.json'),
    path.join(__dirname, '..', 'data', 'moderate_config.json'),
    path.join(__dirname, 'data', 'moderate_config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (j && typeof j === 'object') {
          const cfg = {
            auto_approve: j.auto_approve !== false,
            ai_enabled: j.ai_enabled === true,
            threshold: Math.min(0.99, Math.max(0.1, parseFloat(j.threshold) || 0.75)),
          };
          _cfgCache = { at: now, cfg };
          return cfg;
        }
      }
    } catch (e) {}
  }
  _cfgCache = { at: now, cfg: defaults };
  return defaults;
}
// Nguồn chân lý cho auto-duyệt: file config (admin) + env dự phòng để tắt khẩn cấp
function isAutoApprove() {
  if (String(process.env.COMMENT_AUTO_APPROVE || '') === '0') return false;
  return loadModerateConfig().auto_approve !== false;
}

// Cache banned list 30s
let _bannedCache = { at: 0, list: null };
function loadBannedList() {
  const now = Date.now();
  if (_bannedCache.list && now - _bannedCache.at < 30000) return _bannedCache.list;
  const candidates = [
    path.join(process.cwd(), 'data', 'banned_words.json'),
    path.join(process.cwd(), 'blog-v2', 'data', 'banned_words.json'),
    path.join(__dirname, '..', 'data', 'banned_words.json'),
    path.join(__dirname, 'data', 'banned_words.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const j = JSON.parse(raw);
        if (Array.isArray(j)) {
          _bannedCache = { at: now, list: j.map(s => String(s).trim()).filter(Boolean) };
          return _bannedCache.list;
        }
      }
    } catch (e) {}
  }
  // fallback: đọc từ env nếu file chưa có
  const extra = String(process.env.BANNED_EXTRA || '').split(',').map(s=>s.trim()).filter(Boolean);
  _bannedCache = { at: now, list: extra };
  return _bannedCache.list;
}

const VI_MAP = {'á':'a','à':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a','â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a','é':'e','è':'e','ẻ':'e','ẽ':'e','ẹ':'e','ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e','í':'i','ì':'i','ỉ':'i','ĩ':'i','ị':'i','ó':'o','ò':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o','ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o','ú':'u','ù':'u','ủ':'u','ũ':'u','ụ':'u','ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u','ý':'y','ỳ':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d'};
// Đồng nhất với cmt_norm() trong admin.php: đ->d TRƯỚC khi bỏ dấu,
// nếu không "địt" thành "it", "đm" thành "m" gây chặn nhầm.
function norm(s){
  let t = String(s||'').toLowerCase();
  t = t.split('').map((c) => VI_MAP[c] || c).join('');
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]/g,' ')
    .replace(/\s+/g,' ').trim();
}

function containsBanned(text){
  const n = norm(text);
  if (!n) return null;
  const list = loadBannedList();
  const extra = String(process.env.BANNED_EXTRA||'').split(',').map(s=>norm(s)).filter(Boolean);
  const all = list.map(norm).concat(extra).filter(Boolean);
  for(const w of all){
    if(!w) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    const re = new RegExp('\\b'+esc+'\\b');
    if(re.test(n)) return w;
  }
  return null;
}

function isSpam(text){
  const t = String(text||'');
  if(/(.)\1{5,}/.test(t)) return 'spam: ký tự lặp';
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if(words.length >= 6){
    const cnt={}; for(const w of words){ cnt[w]=(cnt[w]||0)+1; if(cnt[w]>=6) return 'spam: lặp từ';}
  }
  if(t.length >= 10 && t === t.toUpperCase() && /[A-Z]/.test(t)) return 'spam: viết hoa toàn bộ';
  const special = (t.match(/[^a-zA-Z0-9\s\u00C0-\u024F]/g)||[]).length;
  if(t.length>20 && special/t.length > 0.4) return 'spam: nhiều ký tự đặc biệt';
  return null;
}
// Chất lượng thấp: ngắn/gibberish - gương economy.js bonusEligible
function isLowQuality(text){
  const t = String(text||'').trim();
  if(t.length < 12) return 'quá ngắn / kém chất lượng (cần ≥12 ký tự)';
  const letters = (t.match(/[A-Za-zÀ-ỹđ]/g) || []).length;
  if(letters / Math.max(1, t.length) < 0.4) return 'nội dung không rõ nghĩa';
  // câu chỉ 1-2 từ ngắn như Nice, Ok, Keren
  const words = t.split(/\s+/).filter(Boolean);
  if(words.length <= 2 && t.length <= 20) return 'quá ngắn / chung chung';
  return null;
}

// Gọi OpenAI Moderation (omni-moderation-latest, free, hỗ trợ tiếng Việt) —
// chỉ khi admin bật ai_enabled trong data/moderate_config.json VÀ có
// OPENAI_API_KEY ở env Vercel. Key không bao giờ lưu trong repo.
// Chỉ gọi cho comment ĐÃ QUA hết filter local (URL/từ cấm/spam) để tiết kiệm
// quota và latency. Trả về {blocked,score,reason} hoặc null (bỏ qua AI).
async function checkOpenAI(text){
  const cfg = loadModerateConfig();
  if (!cfg.ai_enabled) return null;
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) return null;
  const threshold = parseFloat(process.env.OPENAI_MOD_THRESHOLD || '') || cfg.threshold || 0.75;
  const t = String(text||'').slice(0, 1000).trim();
  if (t.length < 2) return null;
  try {
    const sig = (() => { try { return AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined; } catch { return undefined; } })();
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      signal: sig,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: t }),
    });
    if (!res.ok) return null; // fail-open: key sai/quota/mạng đều không chặn
    const j = await res.json();
    const r = j && j.results && j.results[0];
    const scores = r && r.category_scores;
    if (!scores) return null;
    let maxScore = 0; let maxAttr = '';
    for (const k of Object.keys(scores)) {
      const v = scores[k];
      if (typeof v === 'number' && v > maxScore) { maxScore = v; maxAttr = k; }
    }
    if (maxScore >= threshold) {
      return { blocked: true, score: maxScore, attr: maxAttr, reason: `AI ${maxAttr} ${maxScore.toFixed(2)}` };
    }
    return { blocked: false, score: maxScore, attr: maxAttr, reason: '' };
  } catch (e) {
    return null; // timeout / network => fail-open, giữ local quyết định
  }
}
// Giữ tên cũ để tương thích (comments.js cũ gọi checkPerspective)
const checkPerspective = checkOpenAI;

// Combo chính: local sync trước (URL/từ cấm/spam), AI sau —
// chỉ comment sạch mới tốn 1 call OpenAI
async function checkComment({text, name}){
  const t = String(text||'').trim();
  const n = String(name||'').trim();
  if(t.length < 2) return {ok:false, reason:'quá ngắn'};
  if(t.length > 500) return {ok:false, reason:'quá dài'};
  if(URL_RE.test(t) || URL_RE.test(n)) return {ok:false, reason:'chứa URL/link'};
  if(PHONE_RE.test(t)) return {ok:false, reason:'chứa số điện thoại'};
  if(EMAIL_RE.test(t)) return {ok:false, reason:'chứa email'};
  const bad = containsBanned(t) || containsBanned(n);
  if(bad) return {ok:false, reason:`từ cấm: ${bad}`};
  const spam = isSpam(t);
  if(spam) return {ok:false, reason:spam};
  const low = isLowQuality(t);
  if(low) return {ok:false, reason:low};
  // AI OpenAI (nếu admin bật + có key) — chỉ gọi khi đã qua hết local
  const ai = await checkOpenAI(t);
  if (ai && ai.blocked) return {ok:false, reason: ai.reason};
  return {ok:true, reason:''};
}

// Giữ bản sync cho admin.php preview nhanh (không gọi AI)
function checkCommentSync({text, name}){
  const t = String(text||'').trim();
  const n = String(name||'').trim();
  if(t.length < 2) return {ok:false, reason:'quá ngắn'};
  if(t.length > 500) return {ok:false, reason:'quá dài'};
  if(URL_RE.test(t) || URL_RE.test(n)) return {ok:false, reason:'chứa URL/link'};
  if(PHONE_RE.test(t)) return {ok:false, reason:'chứa số điện thoại'};
  if(EMAIL_RE.test(t)) return {ok:false, reason:'chứa email'};
  const bad = containsBanned(t) || containsBanned(n);
  if(bad) return {ok:false, reason:`từ cấm: ${bad}`};
  const spam = isSpam(t);
  if(spam) return {ok:false, reason:spam};
  const low = isLowQuality(t);
  if(low) return {ok:false, reason:low};
  return {ok:true, reason:''};
}

module.exports = { URL_RE, PHONE_RE, EMAIL_RE, norm, containsBanned, isSpam, checkComment, checkCommentSync, loadBannedList, loadModerateConfig, isAutoApprove, checkOpenAI, checkPerspective };
