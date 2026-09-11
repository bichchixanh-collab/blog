// JAVA WAP SH - J2ME logic (dynamic data)
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function tick(){ const el=$("#clock"); if(el) el.textContent=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); }
tick(); setInterval(tick,30000);
const t0=performance.now();
window.addEventListener('load',()=>{ const dt=((performance.now()-t0)/1000).toFixed(2); const el=$("#loadTime"); if(el) el.textContent=`Tải trong ${dt}s`; });
$("#navToggle")?.addEventListener('click',()=>$("#wapNav")?.classList.toggle('open'));
setInterval(()=>{
  const el=$("#onlineCount"); if(el){
    let n=parseInt(el.textContent,10); n+=Math.floor(Math.random()*5)-2; if(n<280)n=280; if(n>420)n=420; el.textContent=n;
    const b=$$(".stat-list b.online")[0]; if(b) b.textContent=n;
  }
},3000);

// --- Dynamic render ---
let GAMES_CACHE = null;
async function loadGames(){
  if(GAMES_CACHE) return GAMES_CACHE;
  try{
    const r=await fetch('data/games.json?'+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    GAMES_CACHE=await r.json();
    return GAMES_CACHE;
  }catch(e){
    console.error('load games failed',e);
    // fallback: try to keep static html
    return null;
  }
}
function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
function gameCard(g, small=false){
  const hot=g.hot?'<span class="badge-hot">HOT</span>':''; const vi=g.vi?'<span class="badge-vi">VIỆT HÓA</span>':'';
  const n=g.new?'<span class="new">NEW</span>':'';
  const thumbCls = small ? 'game-thumb small' : 'game-thumb';
  const btnCls = small ? 'dl-btn jar small' : 'dl-btn jar';
  const resArr=(g.res||[]);
  const resStr=resArr.map(escHtml).join(' • ');
  const gid=escHtml(g.id||''), gname=escHtml(g.name||''), gcat=escHtml(g.cat||''), gsize=escHtml(g.size||'');
  return `<article class="game-item" data-res="${resArr.map(escHtml).join(' ')}" data-name="${(gname+' '+gcat).toLowerCase()}">
    <img src="${escHtml(g.thumb)}" alt="${gname}" class="${thumbCls}" onerror="this.src='https://picsum.photos/seed/fallback/80/80'">
    <div class="game-info">
      <h3><a href="game.html?id=${gid}">${gname}</a> ${hot} ${vi} ${n}</h3>
      <div class="game-meta">${gcat} • ${gsize} • <b>${resStr}</b></div>
      ${!small?`<div class="game-desc">${escHtml(String(g.desc||'').slice(0,110))}</div>`:''}
    </div>
    <div class="game-download">
      <a href="game.html?id=${gid}" class="${btnCls}">⬇ JAR</a>
      ${!small?`<a href="game.html?id=${gid}" class="dl-link">Chi tiết »</a>`:''}
    </div>
  </article>`;
}
async function renderIndex(){
  const hotBox=$("#hot .game-list");
  const newBox=$("#new .game-list.compact");
  const gridBox=$("#viethoa .game-grid");
  const topBox=$("#sideTop") || $(".top-list");
  if(!hotBox && !newBox) return; // not index page
  const games=await loadGames();
  if(!games) return; // keep static
  // HOT: top 3 downloads
  const hot=[...games].sort((a,b)=>b.downloads-a.downloads).slice(0,3);
  if(hotBox) hotBox.innerHTML=hot.map(g=>gameCard(g,false)).join('');
  // NEW: last 6 (reverse)
  const news=[...games].slice(0,6);
  if(newBox) newBox.innerHTML=news.map(g=>gameCard(g,true)).join('');
  // Grid viet hoa
  if(gridBox){
    const vh=games.filter(g=>g.vi).slice(0,6);
    const src=vh.length?vh:games.slice(0,6);
    gridBox.innerHTML=src.map(g=>`<a href="game.html?id=${escHtml(g.id)}" class="grid-item"><img src="${escHtml(g.thumb)}" alt="${escHtml(g.name)}" onerror="this.src='https://picsum.photos/seed/fb/100/100'"><span>${escHtml(String(g.name||'').split('[')[0].slice(0,18))}</span><small>${escHtml((g.res||[])[0]||'')} • ${escHtml(g.size||'')}</small></a>`).join('');
  }
  // Top sidebar
  const topList=document.getElementById('sideTop');
  if(topList){
    topList.innerHTML=[...games].sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,8).map(g=>`<li><a href="game.html?id=${escHtml(g.id)}">${escHtml(String(g.name||'').split('[')[0].slice(0,22))}</a><span>${((g.downloads||0)/1000).toFixed(1)}k</span></li>`).join('');
  }
  // re-bind filter/search after render
  bindFilters();
}
function bindFilters(){
  $$(".res-btn").forEach(btn=>{
    btn.onclick=()=>{
      $$(".res-btn").forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const res=btn.dataset.res;
      $$(".game-item").forEach(item=>{
        if(res==="all"){ item.classList.remove('hidden'); return; }
        const itemRes=item.dataset.res||""; item.classList.toggle('hidden', !itemRes.includes(res));
      });
    };
  });
  const searchInput=$("#searchInput");
  if(searchInput){
    const doSearch=()=>{
      const q=(searchInput.value||"").toLowerCase().trim();
      $$(".game-item").forEach(item=>{
        const name=(item.dataset.name||"").toLowerCase();
        const title=item.querySelector('h3')?.textContent.toLowerCase()||"";
        const hit=!q || name.includes(q) || title.includes(q);
        item.classList.toggle('hidden', !hit);
      });
      if(q){ $$(".res-btn").forEach(b=>b.classList.remove('active')); $$('.res-btn[data-res="all"]')[0]?.classList.add('active'); }
    };
    searchInput.oninput=doSearch;
    $("#searchForm")?.addEventListener('submit',e=>{e.preventDefault(); doSearch();});
  }
  function esc(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  $$('.wap-nav a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const id=a.getAttribute('href'); if(id.length>1){ e.preventDefault(); document.querySelector(id)?.scrollIntoView({behavior:'smooth'}); $$('.wap-nav a').forEach(x=>x.classList.remove('active')); a.classList.add('active'); $("#wapNav")?.classList.remove('open'); }
    });
  });
}

renderIndex();
