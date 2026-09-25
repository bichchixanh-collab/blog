
function tick(){const el=document.getElementById('clock');if(el)el.textContent=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}tick();setInterval(tick,30000);
try{var _c=document.querySelector('link[rel="canonical"]');if(_c)_c.href=location.origin+'/';}catch(e){}
document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG')return;if(t.id==='wapBannerImg'){if(!t.dataset.fb1){t.dataset.fb1='1';t.src='assets/banners/banner1.webp';}else if(!t.dataset.fb){t.dataset.fb='1';t.src='assets/anime-girl.webp';}return;}if(!t.dataset.fb){t.dataset.fb='1';t.src='assets/anime-girl.webp';}},true);
(function(){
  // Random toàn bộ ảnh trong assets/banners (.png/.jpg/...): quét qua API, không fix cứng tên/số lượng.
  // Thêm/xóa ảnh chỉ cần copy file vào assets/banners.
  // API chỉ trả TÊN FILE; JS tự dựng URL theo đúng subfolder (http://localhost/blog hay domain root đều đúng).
  var FALLBACK_NAMES=['banner1.webp','banner2.webp','banner3.webp','banner4.webp','banner5.webp','banner6.webp'];
  function appRoot(){
    try{
      var p=location.pathname||'/';
      var gi=p.indexOf('/game/');
      if(gi>=0) return p.slice(0,gi).replace(/\/$/,'');
      if(p.length>1&&p.charAt(p.length-1)==='/') return p.slice(0,-1);
      var i=p.lastIndexOf('/');
      return i<=0?'':p.slice(0,i);
    }catch(e){return '';}
  }
  function baseFromApiUrl(u,root){
    try{return new URL('../assets/banners/',u).toString();}catch(e){}
    return root+'/assets/banners/';
  }
  function toNames(a){
    var out=[];
    (a||[]).forEach(function(x){
      if(typeof x!=='string')return;
      x=x.trim(); if(!x)return;
      x=x.split('?')[0].split('#')[0];
      var b=x.substring(x.lastIndexOf('/')+1);
      if(!/\.(png|jpe?g|gif|webp)$/i.test(b))return;
      out.push(b);
    });
    return out;
  }
  function toUrls(names,base){
    if(base.charAt(base.length-1)!=='/')base+='/';
    return names.map(function(n){return base+encodeURIComponent(n);});
  }
  var ROOT=appRoot();
  var FALLBACK_URLS=toUrls(FALLBACK_NAMES,ROOT+'/assets/banners/');
  window.__BANNER_FALLBACK=FALLBACK_URLS;
  window.__BANNER_CACHE=null;
  window.getBannerList=async function(){
    if(window.__BANNER_CACHE&&window.__BANNER_CACHE.length) return window.__BANNER_CACHE;
    var urls=[ROOT+'/api/banners.php',ROOT+'/api/banners',ROOT+'/data/banners.json','api/banners.php','data/banners.json'];
    for(var i=0;i<urls.length;i++){
      var u=urls[i];
      try{
        var r=await fetch(u,{cache:'no-store'});
        if(!r.ok) continue;
        var j=await r.json();
        var names=toNames(Array.isArray(j)?j:(j&&Array.isArray(j.files)?j.files:null));
        if(names.length){
          var respUrl=(r.url&&r.url.indexOf('http')===0)?r.url:new URL(u,location.href).toString();
          var list=toUrls(names,baseFromApiUrl(respUrl,ROOT));
          window.__BANNER_CACHE=list;return list;
        }
      }catch(e){}
    }
    window.__BANNER_CACHE=FALLBACK_URLS;
    return FALLBACK_URLS;
  };
  // Random nhưng KHÔNG trùng ảnh vừa hiện lần trước (lưu tên file vào localStorage).
  function bannerName(u){try{return decodeURIComponent(String(u||'').split('?')[0].split('#')[0].split('/').pop());}catch(e){return '';}}
  function getBannerQueue(){try{var q=JSON.parse(localStorage.getItem('j2me_banner_queue')||'[]');return Array.isArray(q)?q:[];}catch(e){return [];}}
  function saveBannerQueue(q){try{localStorage.setItem('j2me_banner_queue',JSON.stringify(q.slice(0,500)));}catch(e){}}
  function shuffledArr(a){var r=a.slice();for(var i=r.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=r[i];r[i]=r[j];r[j]=t;}return r;}
  window.pickRandomBanner=function(list,nosave){var a=(list&&list.length)?list:(window.__BANNER_CACHE&&window.__BANNER_CACHE.length?window.__BANNER_CACHE:window.__BANNER_FALLBACK);if(!a||!a.length)return '';if(a.length<2)return a[0];var names=a.map(bannerName);var q=getBannerQueue().filter(function(n){return names.indexOf(n)>=0;});if(!q.length){q=shuffledArr(names);try{var last=localStorage.getItem('j2me_last_banner')||'';if(last&&q[0]===last&&q.length>1){q.push(q.shift());}}catch(e){}}var pickName=q[0];var pick=a[names.indexOf(pickName)]||a[0];if(nosave)return pick;q.shift();saveBannerQueue(q);try{localStorage.setItem('j2me_last_banner',pickName);}catch(e){}return pick;};
  var img=document.getElementById('wapBannerImg');
  if(img){
    try{img.src=window.pickRandomBanner(FALLBACK_URLS,true);}catch(e){}
    window.getBannerList().then(function(list){try{img.src=window.pickRandomBanner(list);}catch(e){}}).catch(function(){});
  }
})();
let CACHE=null,GAME_AT=0;async function loadGames(){if(CACHE&&Date.now()-GAME_AT<3e5)return CACHE;try{const s=localStorage.getItem('j2me_games');if(s){const o=JSON.parse(s);if(o&&Date.now()-o.at<3e5&&Array.isArray(o.data)&&o.data.length){CACHE=o.data;GAME_AT=o.at;return CACHE;}}}catch(e){}const r=await fetch('data/games.json',{headers:{Accept:'application/json'}});CACHE=await r.json();GAME_AT=Date.now();try{localStorage.setItem('j2me_games',JSON.stringify({at:GAME_AT,data:CACHE}));}catch(e){}return CACHE;}
function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
// Helper bingo: đánh dấu tiến trình tuần (khớp senpai.js/game.html). Không đổi giao diện.
function __bm(a){try{var d=new Date();var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-day+3);var f=new Date(Date.UTC(t.getUTCFullYear(),0,4));var fd=(f.getUTCDay()+6)%7;f.setUTCDate(f.getUTCDate()-fd+3);var w=1+Math.round((t-f)/6048e5);var W=t.getUTCFullYear()+'-W'+('0'+w).slice(-2);var k='j2me_bingo_prog',o=JSON.parse(localStorage.getItem(k)||'{}');if(!o[W])o[W]={};if(!o[W][a]){o[W][a]=1;localStorage.setItem(k,JSON.stringify(o));}}catch(e){}}
// Yêu thích (localStorage) + cài app PWA
function favGet(){try{const a=JSON.parse(localStorage.getItem('j2me_favs')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function favHas(id){try{return favGet().indexOf(id)>=0;}catch(e){return false;}}
function favToggle(id){try{let a=favGet();const was=a.indexOf(id)>=0;a=was?a.filter(function(x){return x!==id;}):a.concat([id]);localStorage.setItem('j2me_favs',JSON.stringify(a.slice(0,200)));refreshFavHearts();renderFavGrid();try{__bm('fav');}catch(e){}var on=!was;try{stEvent(on?'like':'unlike',id);}catch(e){}return on;}catch(e){return false;}}
function refreshFavHearts(){try{document.querySelectorAll('[data-fav]').forEach(function(b){b.textContent=favHas(b.getAttribute('data-fav'))?'♥':'♡';});}catch(e){}}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;try{document.querySelectorAll('.pwa-install').forEach(function(b){b.style.display='';});}catch(err){}});
function installApp(){if(deferredPrompt){try{deferredPrompt.prompt();deferredPrompt=null;}catch(e){}}else{alert(T('install_msg','Mở menu trình duyệt → "Thêm vào màn hình chính" để cài app.'));}}
// Chuẩn hóa tiếng Việt không dấu để tìm kiếm ("dua xe" vẫn ra "đua xe")
function normVn(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
// XP + nhiệm vụ hằng ngày (xem 3 game / thích 1 / bình luận 1, mỗi cái +10)
function xpAdd(n){try{const o=JSON.parse(localStorage.getItem('j2me_xp')||'{"xp":0}')||{xp:0};o.xp=(o.xp||0)+n;localStorage.setItem('j2me_xp',JSON.stringify(o));}catch(e){}}
function xpBump(kind){
  try{
    if(kind==='fav'){xpAdd(3);qInc('fav');}
  }catch(e){}
}
function qInc(kind){
  try{
    const goals={seen:3,fav:1,cmt:1};
    if(!(kind in goals))return;
    const day=new Date().toISOString().slice(0,10);
    const k='j2me_q_'+kind+'_'+day, dk='j2me_qd_'+kind+'_'+day;
    const v=+(localStorage.getItem(k)||0)+1; localStorage.setItem(k,String(v));
    if(v>=goals[kind]&&!localStorage.getItem(dk)){localStorage.setItem(dk,'1');xpAdd(10);}
  }catch(e){}
}
function T(k,fb){ try{ if(window.I18N&&window.I18N.T) return window.I18N.T(k,fb); }catch(e){} return fb; }
function card(g, idx=0){
  const hot=g.hot?'<span style="background:#0066cc;color:#fff;font-size:8px;padding:2px 4px;border-radius:8px">HOT</span>':''; const vi=g.vi?'<span style="background:#0a9c4a;color:#fff;font-size:8px;padding:2px 4px;border-radius:8px">VIỆT HÓA</span>':''; const lock=(g.gate&&g.gate.type&&g.gate.type!=='none')?'<span style="background:#7a5a00;color:#fff;font-size:8px;padding:2px 4px;border-radius:8px" title="'+T('idx_lock','Cần đủ điều kiện mới tải được')+'">🔒</span>':'';
  const eager = idx < 3 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const gid=escHtml(g.id||''), gname=escHtml(g.name||''), gcat=escHtml(g.cat||''), gsize=escHtml(g.size||''), gthumb=escHtml(g.thumb||''), gres=(g.res||[]).map(escHtml).join(' ');
  return `<div class="game-item" data-res="${gres}" data-name="${(gname+' '+gcat).toLowerCase()}"><img src="${gthumb}" class="game-thumb" width="48" height="48" decoding="async" ${eager} alt="${gname}"><div style="flex:1"><h3><a href="game/${gid}.html">${gname}</a> ${hot} ${vi} ${lock}</h3><div class="game-meta">${gcat} • ${gsize}</div></div><div style="display:grid;gap:4px;justify-items:center"><a href="game/${gid}.html" class="dl-btn">${T('dl','⬇ Tải JAR')}</a><button data-fav="${gid}" title="${T('idx_fav','Yêu thích')}" style="background:none;border:none;color:#0066cc;font-size:15px;cursor:pointer;line-height:1">${favHas(g.id)?'♥':'♡'}</button></div></div>`;
}
function lockBadge(g){return (g&&g.gate&&g.gate.type&&g.gate.type!=='none')?'<span style="background:#7a5a00;color:#fff;font-size:8px;padding:1px 4px;border-radius:4px" title="'+T('idx_lock','Cần đủ điều kiện mới tải được')+'">🔒</span>':'';}
// Hộp thông báo ghim (admin sửa 1 dòng, đóng thì nhớ tới khi có tin mới)
(function(){
  const box=document.getElementById('noticeBox'); if(!box) return;
  fetch('data/notice.json',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(j=>{
    const t=j&&String(j.text||'').trim(); if(!t) return;
    const key='notice_seen_'+(j.updated_at||'x');
    try{if(localStorage.getItem(key)) return;}catch(e){}
    box.innerHTML='<b>'+T('idx_notice','📢 Thông báo:')+'</b> <span id="noticeText"></span> <a href="#" id="noticeHide" style="color:#0066cc;white-space:nowrap">'+T('idx_close','[đóng]')+'</a>';
    box.querySelector('#noticeText').textContent=t;
    box.style.display='';
    box.querySelector('#noticeHide').onclick=function(e){e.preventDefault();box.style.display='none';try{localStorage.setItem(key,'1');}catch(err){}};
  }).catch(function(){});
})();
let FAV_SHOWN=12; const FAV_BATCH=12;
function favCard(g){
  return `<div class="grid-item" style="position:relative"><a href="game/${escHtml(g.id)}.html" style="text-decoration:none"><img src="${escHtml(g.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${escHtml(g.name)}"><span>${escHtml(String(g.name||'').split('[')[0].slice(0,14))}</span><small>${escHtml((g.res||[])[0]||'')}</small></a><button data-fav="${escHtml(g.id)}" title="${T('idx_unfav','Bỏ thích')}" style="position:absolute;top:2px;right:4px;background:none;border:none;color:#0066cc;font-size:14px;cursor:pointer">♥</button></div>`;
}
function renderFavGrid(){
  const sec=document.getElementById('favSection'), grid=document.getElementById('favGrid');
  if(!sec||!grid) return;
  const ids=favGet();
  const byId={}; (CACHE||[]).forEach(g=>{byId[g.id]=g;});
  const items=ids.map(id=>byId[id]).filter(Boolean);
  if(!items.length){sec.style.display='none';grid.innerHTML='';const m=document.getElementById('favMore');if(m)m.remove();return;}
  sec.style.display='';
  FAV_SHOWN=Math.min(Math.max(FAV_BATCH,FAV_SHOWN),items.length);
  grid.innerHTML=items.slice(0,FAV_SHOWN).map(favCard).join('');
  let more=document.getElementById('favMore');
  if(items.length>FAV_SHOWN){
    if(!more){more=document.createElement('button');more.id='favMore';more.style.cssText='margin-top:8px;width:100%;background:#e8f4fd;border:1.5px dashed #4da6ff;border-radius:10px;padding:6px;font-size:11px;color:#0066cc;cursor:pointer';more.onclick=function(){FAV_SHOWN+=FAV_BATCH;renderFavGrid();};grid.after(more);}
    more.textContent=T('fav_more','Xem thêm')+' ('+(items.length-FAV_SHOWN)+')';
    more.style.display='';
  }else if(more){more.remove();}
}
document.addEventListener('click',function(e){const b=e.target&&e.target.closest?e.target.closest('[data-fav]'):null; if(!b) return; e.preventDefault(); try{if(favToggle(b.getAttribute('data-fav')))xpBump('fav');}catch(err){}});
// Gợi ý khi gõ: dropdown tên + thumb (kết hợp tìm không dấu), bấm để sang trang game
function initSuggest(){
  try{
    const form=document.getElementById('searchForm'), input=document.getElementById('searchInput');
    if(!form||!input||document.getElementById('suggestBox'))return;
    form.style.position='relative';
    const box=document.createElement('div');
    box.id='suggestBox';
    box.style.cssText='display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #81c7f0;border-radius:10px;margin-top:4px;overflow:hidden;z-index:500;box-shadow:0 8px 20px rgba(0,102,204,.2)';
    form.appendChild(box);
    input.addEventListener('blur',function(){setTimeout(function(){box.style.display='none';},150);});
    input.addEventListener('keydown',function(e){if(e.key==='Escape')box.style.display='none';});
  }catch(e){}
}
function suggestGames(q){
  try{
    const box=document.getElementById('suggestBox'); if(!box)return;
    const nq=normVn((q||'').trim());
    if(nq.length<1||!CACHE||!CACHE.length){box.style.display='none';box.innerHTML='';return;}
    const hits=CACHE.filter(g=>normVn((g.name||'')+' '+(g.cat||'')).includes(nq)).slice(0,6);
    if(!hits.length){box.style.display='none';box.innerHTML='';return;}
    box.innerHTML=hits.map(g=>`<a href="game/${escHtml(g.id)}.html" style="display:flex;gap:8px;align-items:center;padding:7px 10px;text-decoration:none;border-bottom:1px dashed #b8d8f8"><img src="${escHtml(g.thumb)}" width="32" height="32" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #b8d8f8" alt=""><span style="font-size:12px;font-weight:700;color:#1a3a5c">${escHtml(g.name)}</span><small style="margin-left:auto;color:#4a7a9a;font-size:10px">${escHtml(g.cat||'')}</small></a>`).join('');
    box.style.display='';
    box.querySelectorAll('a').forEach(a=>a.addEventListener('mousedown',function(e){e.preventDefault();location.href=a.href;}));
  }catch(e){}
}
(async()=>{
  const games0=await loadGames();
  if(!games0 || games0.length===0){
    document.getElementById('hotList').innerHTML='<p style="padding:16px;text-align:center;color:#4a7a9a">'+T('idx_empty','Chưa có game nào — vào admin.php để đăng bài đầu tiên ♡')+'</p>';
    document.getElementById('newList').innerHTML='';
    document.getElementById('viethoaGrid').innerHTML='';
    const ex0=document.getElementById('extraList'); if(ex0) ex0.innerHTML='';
    const ex20=document.getElementById('extraGrid2'); if(ex20) ex20.innerHTML='';
    const rnd0=document.getElementById('randomList'); if(rnd0) rnd0.innerHTML='';
    return;
  }
  await paintIndex(games0);
  bindIndexOnce();
  // Revalidate nền: bỏ qua cache 5 phút, có bài mới/sửa thì vẽ lại ngay trong lần mở này
  try{
    const rr=await fetch('data/games.json',{cache:'no-store',headers:{Accept:'application/json'}});
    if(rr.ok){
      const fresh=await rr.json();
      if(Array.isArray(fresh)&&fresh.length){
        const sig=a=>a.map(g=>g.id+'|'+(g.updated_at||'')+'|'+(g.name||'')).join(';');
        if(sig(fresh)!==sig(games0)){
          CACHE=fresh; GAME_AT=Date.now();
          try{localStorage.setItem('j2me_games',JSON.stringify({at:GAME_AT,data:CACHE}));}catch(e){}
          await paintIndex(fresh);
        }
      }
    }
  }catch(e){}
})();
// Phân trang box Mới Cập Nhật: 3 game/trang (mới nhất trước)
let NEW_PAGE=1; const NEW_LIMIT=3;
function newPages(){ const g=(typeof CACHE!=='undefined'&&CACHE)||[]; return Math.max(1,Math.ceil(g.length/NEW_LIMIT)); }
function renderNewPage(){
  const games=(typeof CACHE!=='undefined'&&CACHE)||[];
  const pages=newPages();
  if(NEW_PAGE>pages)NEW_PAGE=pages; if(NEW_PAGE<1)NEW_PAGE=1;
  const box=document.getElementById('newList'); if(!box)return;
  box.innerHTML=games.slice((NEW_PAGE-1)*NEW_LIMIT,NEW_PAGE*NEW_LIMIT).map((g,i)=>card(g,i+3)).join('');
  const pg=document.getElementById('newPager'); if(!pg)return;
  if(pages<=1){pg.innerHTML='';return;}
  const btn=function(label,p,dis,cur){return '<button data-npg="'+p+'" '+(dis?'disabled':'')+' style="background:'+(cur?'#0066cc':'#fff')+';color:'+(cur?'#fff':'#0066cc')+';border:1.5px solid #81c7f0;border-radius:14px;padding:4px 10px;font-size:11px;font-weight:700;cursor:'+(dis?'default':'pointer')+';opacity:'+(dis?'.5':'1')+'">'+label+'</button>';};
  let h=btn('«',NEW_PAGE-1,NEW_PAGE<=1,false);
  for(let p=1;p<=pages;p++){ if(pages>7&&Math.abs(p-NEW_PAGE)>2&&(p!==1&&p!==pages))continue; h+=btn(String(p),p,false,p===NEW_PAGE); }
  h+=btn('»',NEW_PAGE+1,NEW_PAGE>=pages,false);
  pg.innerHTML=h;
  pg.querySelectorAll('[data-npg]').forEach(function(b){b.onclick=function(){const p=parseInt(b.getAttribute('data-npg'),10);if(p>=1&&p<=pages&&p!==NEW_PAGE){NEW_PAGE=p;renderNewPage();try{document.getElementById('new').scrollIntoView({block:'start'});}catch(e){}}};});
}
async function paintIndex(games){
  // Gộp lượt tải thật từ api/stats để bảng HOT/Top xếp đúng (rớt thì dùng số tĩnh)
  try{
    const sr=await fetch('api/stats',{cache:'no-store'});
    if(sr.ok){const sj=await sr.json(); if(sj&&sj.counts) games.forEach(g=>{const c=sj.counts[g.id]; if(c!=null) g.downloads=c;});}
  }catch(e){}
  document.getElementById('hotList').innerHTML=[...games].sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,3).map((g,i)=>card(g,i)).join('');
  // Game đang nổi: lượt tải chia số ngày tuổi (game mới mà hot tự trồi lên)
  try{
    const ageDays=iso=>{try{const t=new Date(iso).getTime();if(isNaN(t))return 9999;return Math.max(1,(Date.now()-t)/864e5);}catch(e){return 9999;}};
    const trending=[...games].map(g=>({g:g,s:(g.downloads||0)/ageDays(g.created_at)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,3);
    if(trending.length){
      let sec=document.getElementById('trendSection');
      if(!sec){sec=document.createElement('section');sec.id='trendSection';sec.className='fabric-box';const h=document.getElementById('hot');if(h&&h.after)h.after(sec);}
      if(sec)sec.innerHTML=`<div class="fabric-title">${T('trend','Game đang nổi')}</div>`+trending.map((x,i)=>card(x.g,i)).join('');
    }
  }catch(e){}
  // Box thống kê công khai (tổng lượt tải + top + tổng bình luận)
  try{
    const totalDl=games.reduce((s,g)=>s+(g.downloads||0),0);
    const topG=[...games].sort((a,b)=>(b.downloads||0)-(a.downloads||0))[0];
    let totalCmt=0;
    await Promise.race([Promise.allSettled(games.slice().sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,8).map(g=>fetch('api/comments?game='+encodeURIComponent(g.id),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.total)totalCmt+=j.total;}).catch(()=>{}))),new Promise(function(res){setTimeout(res,6000);})]);
    const sb=document.getElementById('statsBox');
    if(sb&&(totalDl>0||totalCmt>0)){
      sb.innerHTML=`${T('st_total','Tổng lượt tải:')} <b>${totalDl.toLocaleString('vi-VN')}</b>${topG?` • ${T('st_top','Top:')} <b>${escHtml(String(topG.name||'').split('[')[0].slice(0,20))}</b> (${(topG.downloads||0).toLocaleString('vi-VN')})`:''} • ${T('st_cmt','Bình luận:')} <b>${totalCmt}</b>`;
      sb.style.display='';
    }
  }catch(e){}
  renderNewPage();
  document.getElementById('viethoaGrid').innerHTML=games.filter(g=>g.vi).slice(0,6).map(g=>`<a href="game/${escHtml(g.id)}.html" class="grid-item"><img src="${escHtml(g.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${escHtml(g.name)}"><span>${escHtml(String(g.name||'').split('[')[0].slice(0,14))} ${lockBadge(g)}</span><small>${escHtml((g.res||[])[0]||'')}</small></a>`).join('') || games.slice(0,6).map(g=>`<a href="game/${escHtml(g.id)}.html" class="grid-item"><img src="${escHtml(g.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${escHtml(g.name)}"><span>${escHtml(String(g.name||'').split('[')[0].slice(0,14))} ${lockBadge(g)}</span></a>`).join('');
  const extra=document.getElementById('extraList'); if(extra) extra.innerHTML=games.slice(3,6).map(g=>card(g)).join('');
  const extra2=document.getElementById('extraGrid2'); if(extra2) extra2.innerHTML=games.slice(6,9).map(g=>`<a href="game/${escHtml(g.id)}.html" class="grid-item"><img src="${escHtml(g.thumb)}" width="48" height="48" loading="lazy" alt="${escHtml(g.name)}"><span>${escHtml(String(g.name||'').split('[')[0].slice(0,12))} ${lockBadge(g)}</span><small>${escHtml(g.size||'')}</small></a>`).join('');
  const rnd=document.getElementById('randomList'); if(rnd) rnd.innerHTML=[...games].sort(()=>0.5-Math.random()).slice(0,3).map(g=>card(g)).join('');
  refreshFavHearts(); renderFavGrid();
  const catIdx=document.getElementById('catGridIndex');
  if(catIdx){
    const cats=['Hành Động','Nhập Vai','Đua xe','Bắn súng','Trí tuệ','Thể thao','Phiêu lưu','Nông trại','Việt Hóa'];
    const catDisp=function(c){ try{ if(window.I18N&&window.I18N.catName) return window.I18N.catName(c); }catch(e){} return c; };
    const counts={}; games.forEach(g=>{counts[g.cat]=(counts[g.cat]||0)+1; if(g.vi) counts['Việt Hóa']=(counts['Việt Hóa']||0)+1;});
    catIdx.innerHTML=cats.map(c=>{
      const cnt=counts[c]||0;
      const icon=c==='Hành Động'?'⚔️':c==='Nhập Vai'?'🧙':c==='Đua xe'?'🏎️':c==='Bắn súng'?'🔫':c==='Trí tuệ'?'🧩':c==='Thể thao'?'⚽':c==='Phiêu lưu'?'🗺️':c==='Nông trại'?'🌾':'🇻🇳';
      return `<a href="category.html?cat=${encodeURIComponent(c)}" style="background:#fff;border:1.5px solid #b8d8f8;border-radius:10px;padding:8px;text-align:center;text-decoration:none"><div style="font-size:18px">${icon}</div><b style="font-size:10px;color:#1a3a5c">${catDisp(c)}</b><br><small style="color:#4a7a9a">${cnt}</small></a>`;
    }).join('');
  }
}
// Vẽ lại các thẻ động khi i18n sẵn sàng / đổi ngôn ngữ (chỉ khi đang là ID)
document.addEventListener('i18n-ready',function(){
  try{
    if(!(window.I18N&&I18N.lang&&I18N.lang()!=='vi')) return;
    if(typeof CACHE!=='undefined'&&CACHE&&CACHE.length&&typeof paintIndex==='function'){ paintIndex(CACHE); }
  }catch(e){}
});
let __indexBound=false;
function bindIndexOnce(){
  if(__indexBound) return; __indexBound=true;
  document.getElementById('searchInput')?.addEventListener('input',e=>{
    const q=normVn(e.target.value.trim());
    document.querySelectorAll('.game-item').forEach(it=>{const hit=!q||normVn(it.dataset.name||'').includes(q); it.style.display=hit?'flex':'none'})
    suggestGames(e.target.value);
  });
  initSuggest();
  document.querySelectorAll('.res-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.res-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const res=b.dataset.res;
    document.querySelectorAll('.game-item').forEach(it=>{
      const rr=it.dataset.res||'';
      it.style.display=(res==='all'||(' '+rr+' ').includes(res))?'flex':'none';
    });
  }));
}
// Trang chủ: nút ⬇ JAR dẫn thẳng tới trang chi tiết để chọn độ phân giải + tải link thật.
// (Không chặn modal ở đây như trước nữa — bản cũ tự chế link /files/ giả nên toàn báo "link demo".)
(function(){
  const modal=document.getElementById('dlModal');
  const close=()=>{
    modal.classList.add('hidden');
    document.body.style.overflow='';
  };
  document.getElementById('modalClose')?.addEventListener('click',close);
  document.getElementById('modalCancel')?.addEventListener('click',close);
  modal?.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !modal.classList.contains('hidden')) close(); });
  document.getElementById('modalConfirm')?.addEventListener('click',()=>{close();});
})();



(function(){function paint(){try{var on=document.documentElement.classList.contains('lite');var b=document.getElementById('liteToggle');if(b)b.textContent=on?'📶 Đủ':'📴 Nhẹ';}catch(e){}}try{var b=document.getElementById('liteToggle');if(b)b.onclick=function(){try{var h=document.documentElement;if(h.classList.contains('lite')){h.classList.remove('lite');localStorage.setItem('j2me_lite','0');}else{h.classList.add('lite');localStorage.setItem('j2me_lite','1');}paint();}catch(e){}};paint();}catch(e){}})();


try{document.querySelectorAll('.js-year').forEach(function(el){el.textContent=new Date().getFullYear();});}catch(e){}


// Stats local cho khóa tải: phút online + lượt thích + phá đảo + tên bình luận
function stGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function stSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function stMinutes(){return Math.floor((+stGet('j2me_online_ms',0))/60000);}
function stLikes(){var a=stGet('j2me_favs',[]);return Array.isArray(a)?a.length:0;}
function stDone(){var a=stGet('j2me_done',[]);return Array.isArray(a)?a.length:0;}
function stNames(){var a=stGet('j2me_names',[]);return Array.isArray(a)?a.filter(Boolean).slice(0,5):[];}
function stSaveName(n){n=String(n||'').trim().slice(0,30);if(n.length<2)return;var a=stNames(),l=n.toLowerCase(),has=false;for(var i=0;i<a.length;i++)if(String(a[i]).toLowerCase()===l)has=true;if(!has){a.push(n);stSet('j2me_names',a.slice(-5));}}
function stApiRoot(){try{var p=location.pathname||'/';var gi=p.indexOf('/game/');return gi>=0?p.slice(0,gi):'';}catch(e){return '';}}
function stToken(){try{var s=JSON.parse(localStorage.getItem('sb_session')||'null');return (s&&s.access_token)||'';}catch(e){return '';}}
function stUid(){try{var t=stToken();if(!t)return '';var p=(t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';var j=JSON.parse(atob(p));return j.sub||'';}catch(e){return '';}}
function stLogged(){return !!stToken();}
function stAuthHeaders(){var t=stToken();return t?{'Authorization':'Bearer '+t}:{};}
function stEvent(t,id){try{var tk=stToken();if(!tk)return;fetch(stApiRoot()+'/api/ustats',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({t:t,id:String(id||'').slice(0,120)}),keepalive:true}).catch(function(){});}catch(e){}}
var _stApprCache={at:0,n:-1};
function stCid(){try{var c=localStorage.getItem('j2me_cid');if(typeof c==='string'&&/^[0-9a-f]{24}$/.test(c))return c;c='';var ch='0123456789abcdef';for(var i=0;i<24;i++)c+=ch[Math.floor(Math.random()*16)];try{localStorage.setItem('j2me_cid',c);}catch(e){}return c;}catch(e){return '';}}
function stApprovedCount(cb){var now=Date.now();if(_stApprCache.n>=0&&now-_stApprCache.at<60000){cb(_stApprCache.n);return;}var tk='';try{tk=stToken();}catch(e){}var names=stNames();if(!tk&&!names.length){cb(0);return;}var url=stApiRoot()+'/api/comments?mine=1'+(names.length?'&names='+encodeURIComponent(names.join(',')):'');var hh=tk?{'Authorization':'Bearer '+tk}:{};fetch(url,{headers:hh,cache:'no-store'}).then(function(r){return r.json();}).then(function(j){var n=+(j&&j.mine)||0;_stApprCache={at:now,n:n};cb(n);}).catch(function(){cb(_stApprCache.n>=0?_stApprCache.n:0);});}
(function(){try{setInterval(function(){try{if(document.hidden)return;var ms=+localStorage.getItem('j2me_online_ms')||0;localStorage.setItem('j2me_online_ms',String(ms+60000));}catch(e){}try{var tk=stToken();if(tk)fetch(stApiRoot()+'/api/ustats',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({t:'heartbeat'}),keepalive:true}).catch(function(){});}catch(e){}try{var pr=null;try{pr=JSON.parse(localStorage.getItem('j2me_presence')||'null');}catch(e){}fetch(stApiRoot()+'/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tok:(pr&&pr.tok)||'',cid:stCid()}),keepalive:true}).then(function(r){return r.json();}).then(function(j){if(j&&j.tok)try{localStorage.setItem('j2me_presence',JSON.stringify({tok:j.tok,n:j.n||0}));}catch(e){}}).catch(function(){});}catch(e){}},60000);}catch(e){}})();

// CSP strict: handle pwa-install without inline onclick
try{document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('.pwa-install'):null; if(b){e.preventDefault(); try{installApp();}catch(err){}}});}catch(e){}
try{var f=document.getElementById('searchForm'); if(f) f.addEventListener('submit',function(e){e.preventDefault();});}catch(e){}
