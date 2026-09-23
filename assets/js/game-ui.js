// game-ui
(function(){
  // Random toàn b�" ảnh trong assets/banners (.png/.jpg/...): quét qua API, không fix cứng tên/s� lượng.
  // ThÃªm/xÃ³a áº£nh chá»‰ cáº§n copy file vÃ o assets/banners.
  // API chá»‰ tráº£ TÃŠN FILE; JS tá»± dá»±ng URL theo Ä‘Ãºng subfolder (http://localhost/blog hay domain root Ä‘á»u Ä‘Ãºng).
  var FALLBACK_NAMES=['banner1.png','banner2.png','banner3.png','banner4.png','banner5.png','banner6.png','banner7.png','banner8.png'];
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
    // Chá»‰ dÃ¹ng endpoint tuyá»‡t Ä‘á»‘i theo ROOT. KHÃ”NG dÃ¹ng relative 'api/...'/'data/...'
    // vÃ¬ tá»« trang /game/*.html chÃºng resolve thÃ nh /game/api/... gÃ¢y 404/403 rÃ¡c console.
    var urls=[ROOT+'/api/banners',ROOT+'/data/banners.json',ROOT+'/api/banners.php'];
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
  // Random nhưng KH�NG trùng ảnh vừa hi�!n lần trư�:c (lưu tên file vào localStorage).
  function bannerName(u){try{return decodeURIComponent(String(u||'').split('?')[0].split('#')[0].split('/').pop());}catch(e){return '';}}
  function lastBanner(){try{return localStorage.getItem('j2me_last_banner')||'';}catch(e){return '';}}
  function saveBanner(n){try{if(n)localStorage.setItem('j2me_last_banner',n);}catch(e){}}
  window.pickRandomBanner=function(list,nosave){var a=(list&&list.length)?list:(window.__BANNER_CACHE&&window.__BANNER_CACHE.length?window.__BANNER_CACHE:window.__BANNER_FALLBACK);if(!a||!a.length)return '';if(a.length<2){if(!nosave)saveBanner(bannerName(a[0]));return a[0];}var last=lastBanner(),pick=a[Math.floor(Math.random()*a.length)],tries=0;while(bannerName(pick)===last&&tries<10){pick=a[Math.floor(Math.random()*a.length)];tries++;}if(!nosave)saveBanner(bannerName(pick));return pick;};
  // Link chÃ¢n trang theo Ä‘Ãºng subfolder (trang game cÃ³ thá»ƒ á»Ÿ /game/ sÃ¢u 1 cáº¥p)
  try{document.querySelectorAll('a[data-root-link]').forEach(function(a){a.href=ROOT+'/'+a.getAttribute('data-root-link');});document.querySelectorAll('img[data-root-src]').forEach(function(im){im.src=ROOT+'/'+im.getAttribute('data-root-src');});document.querySelectorAll('link[data-root-href]').forEach(function(l){l.href=ROOT+'/'+l.getAttribute('data-root-href');});}catch(e){}
  var img=document.getElementById('wapBannerImg');
  if(img){
    try{img.src=window.pickRandomBanner(FALLBACK_URLS,true);}catch(e){}
    window.getBannerList().then(function(list){try{img.src=window.pickRandomBanner(list);}catch(e){}}).catch(function(){});
  }
})();
// Lightbox xem áº£nh vuá»‘t
let CURRENT_SHOTS=[];
let LB_INDEX=0;
const lb=document.getElementById('lightbox');
const lbTrack=document.getElementById('lbTrack');
const lbCounter=document.getElementById('lbCounter');
function renderLightbox(){
  const n=CURRENT_SHOTS.length;
  lbTrack.style.width=`${n*100}vw`;
  lbTrack.innerHTML=CURRENT_SHOTS.map(s=>`<img src="${s}" alt="Screenshot" style="width:100vw">`).join('');
  updateLightboxPos(false);
}
function updateLightboxPos(animate=true){
  lbTrack.style.transition=animate?'transform .25s ease':'none';
  lbTrack.style.transform=`translateX(${-LB_INDEX*100}vw)`;
  lbCounter.textContent=`${LB_INDEX+1} / ${CURRENT_SHOTS.length}`;
}
function openLightbox(idx){
  if(!CURRENT_SHOTS.length) return;
  LB_INDEX=idx;
  renderLightbox();
  lb.classList.remove('hidden');
  document.body.style.overflow='hidden';
}
function closeLightbox(){
  lb.classList.add('hidden');
  document.body.style.overflow='';
}
function lbGoto(idx){
  if(idx<0) idx=0;
  if(idx>CURRENT_SHOTS.length-1) idx=CURRENT_SHOTS.length-1;
  LB_INDEX=idx;
  updateLightboxPos(true);
}
document.getElementById('lbClose').addEventListener('click',closeLightbox);
document.getElementById('lbPrev').addEventListener('click',()=>lbGoto(LB_INDEX-1));
document.getElementById('lbNext').addEventListener('click',()=>lbGoto(LB_INDEX+1));
lb.addEventListener('click',e=>{ if(e.target===lb) closeLightbox(); });
document.addEventListener('keydown',e=>{
  if(lb.classList.contains('hidden')) return;
  if(e.key==='Escape') closeLightbox();
  if(e.key==='ArrowLeft') lbGoto(LB_INDEX-1);
  if(e.key==='ArrowRight') lbGoto(LB_INDEX+1);
});
// Vuá»‘t (touch swipe)
let touchStartX=0, touchDeltaX=0, touching=false;
lbTrack.addEventListener('touchstart',e=>{
  touching=true; touchStartX=e.touches[0].clientX; touchDeltaX=0;
  lbTrack.style.transition='none';
},{passive:true});
lbTrack.addEventListener('touchmove',e=>{
  if(!touching) return;
  touchDeltaX=e.touches[0].clientX-touchStartX;
  lbTrack.style.transform=`translateX(calc(${-LB_INDEX*100}vw + ${touchDeltaX}px))`;
},{passive:true});
lbTrack.addEventListener('touchend',()=>{
  if(!touching) return;
  touching=false;
  const threshold=(lb.clientWidth||1)*0.18;
  if(touchDeltaX>threshold) lbGoto(LB_INDEX-1);
  else if(touchDeltaX<-threshold) lbGoto(LB_INDEX+1);
  else updateLightboxPos(true);
});
// Cảnh báo trư�:c khi m�x link ngoài trong mô tả
document.addEventListener('click',function(e){
  const a=e.target&&e.target.closest?e.target.closest('.body-text a[target="_blank"]'):null;
  if(!a) return;
  e.preventDefault();
  document.getElementById('extUrl').textContent=a.href;
  document.getElementById('extGo').href=a.href;
  document.getElementById('extModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
});
(function(){
  const m=document.getElementById('extModal'); if(!m) return;
  const close=function(){m.classList.add('hidden');document.body.style.overflow='';};
  document.getElementById('extBack')?.addEventListener('click',close);
  m.addEventListener('click',function(e){if(e.target===m)close();});
  document.getElementById('extGo')?.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.classList.contains('hidden'))close();});
})();
