// game-common
(function(){try{var p=location.pathname||'/';var gi=p.indexOf('/game/');var r=gi>=0?p.slice(0,gi).replace(/\/$/,''):(p.length>1&&p.charAt(p.length-1)==='/'?p.slice(0,-1):p.slice(0,Math.max(0,p.lastIndexOf('/'))));var m=document.getElementById('pwaManifest');if(m)m.href=r+'/manifest.webmanifest';if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register(r+'/sw.js').catch(function(){});});}}catch(e){}})();
try{if(localStorage.getItem('j2me_lite')==='1')document.documentElement.classList.add('lite');}catch(e){}
function tick(){const el=document.getElementById('clock');if(el)el.textContent=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
tick();setInterval(tick,30000);
document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG')return;if(t.id==='wapBannerImg'){if(!t.dataset.fb1){t.dataset.fb1='1';t.src=apiRoot()+'/assets/banners/banner1.png';}else if(!t.dataset.fb){t.dataset.fb='1';t.src=apiRoot()+'/assets/anime-girl.png';}return;}if(!t.dataset.fb){t.dataset.fb='1';t.src=apiRoot()+'/assets/anime-girl.png';}},true);
// Dynamic - giá»¯ y giao diá»‡n váº£i
let GAMES_MAP=null;
async function loadMap(force){ if(GAMES_MAP&&!force) return GAMES_MAP; const r=await fetch(apiRoot()+'/data/games.json',{headers:{Accept:'application/json'}}); const arr=await r.json(); GAMES_MAP={}; arr.forEach(g=>GAMES_MAP[g.id]=g); return GAMES_MAP; }
function getId(){
  const p=new URLSearchParams(location.search);
  let id=p.get('id');
  if(id) return id.replace(/\.html$/,'');
  const m=location.pathname.match(/\/game\/([^\/]+)\.html$/);
  if(m) return decodeURIComponent(m[1]);
  const m2=location.pathname.match(/\/game\/([^\/]+)$/);
  if(m2) return decodeURIComponent(m2[1]);
  return 'kiem-linh-chu-tien-chi-chien';
}
// Chá»‘ng XSS: escape má»i dá»¯ liá»‡u game trÆ°á»›c khi chÃ¨n vÃ o HTML; linkify biáº¿n URL trong mÃ´ táº£ thÃ nh link báº¥m Ä‘Æ°á»£c
function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
function linkify(s){return escHtml(s).replace(/\*\*([^*<>]+)\*\*/g,'<b>$1</b>').replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');}
// Tháº» [credit]...[/credit] trong mÃ´ táº£: há»™p chá»§ quyá»n ná»•i báº­t, link tuyá»‡t Ä‘á»‘i + nÃºt chÃ©p
// Ä‘á»ƒ khi bÃ i bá»‹ copy Ä‘i nÆ¡i khÃ¡c váº«n mang theo nguá»“n. KhÃ´ng cÃ³ tháº» thÃ¬ render nhÆ° cÅ©.
// DÃ²ng Â© NGUá»’N Ä‘á»©ng ngay trÆ°á»›c [credit] Ä‘Æ°á»£c gá»™p lÃ m tiÃªu Ä‘á» há»™p (khÃ´ng render 2 láº§n).
function creditHeaderHtml(h){
  var t=escHtml(String(h||'').trim());
  if(!t) t=cmtT('g_creditSrc','Â© NGUá»’N: J2ME.VERCEL.APP');
  t=t.replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener" style="color:#7a5a00">$1</a>');
  if(t.indexOf('J2ME.VERCEL.APP')<0) t+=' â€” <a href="https://J2ME.VERCEL.APP" target="_blank" rel="noopener" style="color:#7a5a00">J2ME.VERCEL.APP</a>';
  return t;
}
function renderCreditBox(inner,headerHtml){
  var body=String(inner).replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  return '<div class="credit-box" style="margin:10px 0;padding:10px 12px;background:linear-gradient(180deg,#fffbe6,#fff3c4);border:2px dashed #e6a800;border-radius:10px;box-shadow:0 2px 8px rgba(230,168,0,.25)">'
  +'<div style="font-weight:800;color:#7a5a00;font-size:12px;margin-bottom:6px">'+headerHtml+'</div>'
  +'<div style="font-size:12.5px;color:#1a3a5c;white-space:pre-line">'+body+'</div>'
  +'<div style="margin-top:8px"><button type="button" data-credit-copy="1" style="background:#7a5a00;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">'+cmtT('g_creditCopy','ðŸ“‹ ChÃ©p credit')+'</button></div></div>';
}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-credit-copy]'):null;if(!b)return;try{navigator.clipboard.writeText(b.parentNode.parentNode.innerText).then(function(){b.textContent=cmtT('g_creditCopied','âœ“ ÄÃ£ chÃ©p!');}).catch(function(){});}catch(err){}});
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest?e.target.closest('[data-eco-comment]'):null;if(!b)return;
  try{var mc=document.getElementById('modalCancel');if(mc)mc.click();}catch(err){}
  setTimeout(function(){
    try{
      var box=document.getElementById('cmtBox'); if(box){box.style.display='block';box.scrollIntoView({behavior:'smooth',block:'start'});}
      var tx=document.getElementById('cmtText'); if(tx)tx.focus({preventScroll:true});
    }catch(err2){}
  },150);
});
function renderDesc(s){
  var parts=[],heads=[];
  var raw=String(s||'');
  raw=raw.replace(/([^\n]*Â©[^\n]*)\r?\n\s*\[credit\]/gi,function(m,h){heads.push(h);return '[credit]@@HDR'+(heads.length-1)+'@@\n';});
  var t=escHtml(raw);
  t=t.replace(/\[credit\]([\s\S]*?)\[\/credit\]/gi,function(m,inner){parts.push(inner);return 'CREDITBOX'+(parts.length-1)+'X';});
  t=t.replace(/\*\*([^*<>]+)\*\*/g,'<b>$1</b>').replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  for(var i=0;i<parts.length;i++){
    (function(idx){
      var inner=parts[idx],h='';
      inner=inner.replace(/@@HDR(\d+)@@/,function(mm,k){h=creditHeaderHtml(heads[+k]||'');return '';});
      t=t.split('CREDITBOX'+idx+'X').join(renderCreditBox(inner,h||creditHeaderHtml('')));
    })(i);
  }
  return t;
}
function apiRoot(){try{const p=location.pathname||'/';const gi=p.indexOf('/game/');return gi>=0?p.slice(0,gi):'';}catch(e){return '';}}
function isPreviewMode(){try{return new URLSearchParams(location.search).get('preview')==='1';}catch(e){return false;}}
// Äáº¿m lÆ°á»£t báº¥m táº£i tháº­t: má»—i mÃ¡y 1 lÆ°á»£t/ngÃ y/game, gá»­i ná»n khÃ´ng cháº·n táº£i
function countDownload(gameId){
  if(!gameId||isPreviewMode())return;
  try{
    const day=new Date().toISOString().slice(0,10);
    const k='dl_'+gameId+'_'+day;
    if(localStorage.getItem(k))return;
    localStorage.setItem(k,'1');
    xpBump('download',gameId);
    // KhÃ´ng POST /api/stats á»Ÿ Ä‘Ã¢y ná»¯a â€” gateway /api/dl Ä‘Ã£ Ä‘áº¿m server-side,
    // trÃ¡nh Ä‘áº¿m trÃ¹ng 2 láº§n cho 1 lÆ°á»£t táº£i.
  }catch(e){}
}
// YÃªu thÃ­ch (localStorage, tá»‘i Ä‘a 200 game)
function favGet(){try{const a=JSON.parse(localStorage.getItem('j2me_favs')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function favHas(id){try{return favGet().indexOf(id)>=0;}catch(e){return false;}}
function favToggle(id){try{let a=favGet();a=a.indexOf(id)>=0?a.filter(function(x){return x!==id;}):a.concat([id]);localStorage.setItem('j2me_favs',JSON.stringify(a.slice(0,200)));var _fr=a.indexOf(id)>=0;try{stEvent(_fr?'like':'unlike',id);}catch(e){}return _fr;}catch(e){return false;}}
function copyPageUrl(url,btn){function done(t){if(btn){btn.textContent=t;setTimeout(function(){btn.textContent=cmtT('g_copy','Copy link');},1500);}}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){done(cmtT('g_copied','ÄÃ£ copy!'));}).catch(function(){done(cmtT('g_copyerr','Copy lá»—i'));});}else{try{const ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done(cmtT('g_copied','ÄÃ£ copy!'));}catch(e){done(cmtT('g_copyerr','Copy lá»—i'));}}}
// XP + nhiá»‡m vá»¥ háº±ng ngÃ y (xem 3 game / thÃ­ch 1 / bÃ¬nh luáº­n 1, má»—i cÃ¡i +10)
function xpAdd(n){try{const o=JSON.parse(localStorage.getItem('j2me_xp')||'{"xp":0}')||{xp:0};o.xp=(o.xp||0)+n;localStorage.setItem('j2me_xp',JSON.stringify(o));}catch(e){}}
function xpBump(kind,gameId){
  try{
    if(kind==='visit'&&gameId){let a=[];try{a=JSON.parse(localStorage.getItem('j2me_seen')||'[]');}catch(e){}if(a.indexOf(gameId)<0){a.push(gameId);localStorage.setItem('j2me_seen',JSON.stringify(a.slice(0,500)));xpAdd(5);qInc('seen');}}
    if(kind==='download'&&gameId){xpAdd(10);try{localStorage.setItem('j2me_dl_total',String(+(localStorage.getItem('j2me_dl_total')||0)+1));}catch(e){}}
    if(kind==='fav'){xpAdd(3);qInc('fav');}
    if(kind==='comment'){xpAdd(15);qInc('cmt');try{localStorage.setItem('j2me_cmt_total',String(+(localStorage.getItem('j2me_cmt_total')||0)+1));}catch(e){}}
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
// NÃºt cÃ i app PWA (hiá»‡n khi trÃ¬nh duyá»‡t cho phÃ©p)
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;try{document.querySelectorAll('.pwa-install').forEach(function(b){b.style.display='';});}catch(err){}});
function installApp(){if(deferredPrompt){try{deferredPrompt.prompt();deferredPrompt=null;}catch(e){}}else{alert(cmtT('install_msg','Má»Ÿ menu trÃ¬nh duyá»‡t â†’ "ThÃªm vÃ o mÃ n hÃ¬nh chÃ­nh" Ä‘á»ƒ cÃ i app.'));}}
(function(){function paint(){try{var on=document.documentElement.classList.contains('lite');var b=document.getElementById('liteToggle');if(b)b.textContent=on?'ðŸ“¶ Äá»§':'ðŸ“´ Nháº¹';}catch(e){}}try{var b=document.getElementById('liteToggle');if(b)b.onclick=function(){try{var h=document.documentElement;if(h.classList.contains('lite')){h.classList.remove('lite');localStorage.setItem('j2me_lite','0');}else{h.classList.add('lite');localStorage.setItem('j2me_lite','1');}paint();}catch(e){}};paint();}catch(e){}})();
try{document.querySelectorAll('.js-year').forEach(function(el){el.textContent=new Date().getFullYear();});}catch(e){}
// Stats local cho khÃ³a táº£i: phÃºt online + lÆ°á»£t thÃ­ch + phÃ¡ Ä‘áº£o + tÃªn bÃ¬nh luáº­n
function stGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function stSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function stLikes(){var a=stGet('j2me_favs',[]);return Array.isArray(a)?a.length:0;}
function stDone(){var a=stGet('j2me_done',[]);return Array.isArray(a)?a.length:0;}
function stNames(){var a=stGet('j2me_names',[]);return Array.isArray(a)?a.filter(Boolean).slice(0,5):[];}
function stSaveName(n){n=String(n||'').trim().slice(0,30);if(n.length<2)return;var a=stNames(),l=n.toLowerCase(),has=false;for(var i=0;i<a.length;i++)if(String(a[i]).toLowerCase()===l)has=true;if(!has){a.push(n);stSet('j2me_names',a.slice(-5));}}
function stApiRoot(){try{var p=location.pathname||'/';var gi=p.indexOf('/game/');return gi>=0?p.slice(0,gi):'';}catch(e){return '';}}
function stToken(){try{var s=JSON.parse(localStorage.getItem('sb_session')||'null');return (s&&s.access_token)||'';}catch(e){return '';}}
// Token tÆ°Æ¡i: tá»± refresh khi sáº¯p háº¿t háº¡n (SBAuth), rá»›t vá» token cÅ© náº¿u khÃ´ng refresh Ä‘Æ°á»£c.
// Form bÃ¬nh luáº­n/vÃ­/vÃ© DÃ™NG HÃ€M NÃ€Y thay vÃ¬ stToken() Ä‘á»ƒ server luÃ´n nháº­n Ä‘Ãºng tÃ i khoáº£n.
async function stFreshToken(){try{if(window.SBAuth&&SBAuth.session){var s=await SBAuth.session();if(s&&s.access_token)return s.access_token;}}catch(e){}try{return stToken();}catch(e){return '';}}
function stUid(){try{var t=stToken();if(!t)return '';var p=(t.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';var j=JSON.parse(atob(p));return j.sub||'';}catch(e){return '';}}
function stLogged(){return !!stToken();}
function stAuthHeaders(){var t=stToken();return t?{'Authorization':'Bearer '+t}:{};}
function stEvent(t,id){try{var tk=stToken();if(!tk)return;fetch(stApiRoot()+'/api/ustats',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tk},body:JSON.stringify({t:t,id:String(id||'').slice(0,120)}),keepalive:true}).catch(function(){});}catch(e){}}
var _stApprCache={at:0,n:-1};
function stCid(){try{var c=localStorage.getItem('j2me_cid');if(typeof c==='string'&&/^[0-9a-f]{24}$/.test(c))return c;c='';var ch='0123456789abcdef';for(var i=0;i<24;i++)c+=ch[Math.floor(Math.random()*16)];try{localStorage.setItem('j2me_cid',c);}catch(e){}return c;}catch(e){return '';}}
function stApprovedCount(cb){var now=Date.now();if(_stApprCache.n>=0&&now-_stApprCache.at<60000){cb(_stApprCache.n);return;}var tk='';try{tk=stToken();}catch(e){}var names=stNames();if(!tk&&!names.length){cb(0);return;}var url=stApiRoot()+'/api/comments?mine=1'+(names.length?'&names='+encodeURIComponent(names.join(',')):'');var hh=tk?{'Authorization':'Bearer '+tk}:{};fetch(url,{headers:hh,cache:'no-store'}).then(function(r){return r.json();}).then(function(j){var n=+(j&&j.mine)||0;_stApprCache={at:now,n:n};cb(n);}).catch(function(){cb(_stApprCache.n>=0?_stApprCache.n:0);});}

// Cai app PWA (thay onclick inline de dat CSP strict).
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-pwa-install]'):null;if(!b)return;e.preventDefault();try{installApp();}catch(err){}});
