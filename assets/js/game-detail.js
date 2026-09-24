// game-detail
// Lưu ý: phút online của khách �ược server xác minh qua presence chain �ã ký;
// like/phá �ảo vẫn là s� local (khóa mềm) � �ủ chặn link copy tay qua proof.
// Vé đọc bài: đếm thời gian mở trang (dừng khi tab ẩn), vé do server ký lúc mở trang.
let READ={need:10,rz:'',t0:0,hideAcc:0,hideStart:0};
function readSecsOf(g){var v=parseInt(g&&(g.read_secs),10);return (typeof v==='number'&&isFinite(v))?Math.max(1,Math.min(3600,v)):10;}
function readStart(gid,need){READ={need:need,rz:'',t0:Date.now(),hideAcc:0,hideStart:0,ui:null,lastTry:0};try{window.__readRZ='';}catch(e){}fetch(apiRoot()+'/api/read?id='+encodeURIComponent(gid),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.rz){READ.rz=j.rz;try{window.__readRZ=j.rz;}catch(e){}}}).catch(function(){});try{if(READ.ui)clearInterval(READ.ui);}catch(e){}try{READ.ui=setInterval(readUI,1000);}catch(e){}}
function readUI(){
  try{
    var s=Math.floor(readElapsed()/1000), need=READ.need||10;
    if(s>=need){ s=need; try{ if(READ.ui){ clearInterval(READ.ui); READ.ui=null; } }catch(e){} }
    var note=document.getElementById('readNote');
    if(note){
      note.textContent = s>=need
        ? cmtT('g_readDone',"Đã đọc đủ — bấm Tải để tiếp tục")
        : cmtT('g_readWait',"Đã đọc {s}/{n}s…").replace('{s}',s).replace('{n}',need);
    }
  }catch(e){}
}
function readElapsed(){try{var now=Date.now();var extra=(READ.hideStart?now-READ.hideStart:0);return Math.max(0,now-READ.t0-READ.hideAcc-extra);}catch(e){return 0;}}
document.addEventListener('visibilitychange',function(){try{if(document.hidden){READ.hideStart=Date.now();}else if(READ.hideStart){READ.hideAcc+=Date.now()-READ.hideStart;READ.hideStart=0;}}catch(e){}});
function __gate(g){
  var gt=g&&g.gate&&g.gate.type;
  if(!gt||gt==='none')return null;
  if(gt==='xp'){var x=0;try{var o=JSON.parse(localStorage.getItem('j2me_xp')||'{"xp":0}');x=o.xp||0;}catch(e){}var nx=Math.max(1,parseInt(g.gate.xp||100,10)||100);return x>=nx?null:{label:cmtT('g_gateXp',"Tổng {n} XP").replace('{n}',nx),need:cmtT('g_gateXpHas',"đang có {x} XP").replace('{x}',x)};}
  return null;
}
function __proof(g){
  try{
    var st={likes:0,done:0,names:[]};
    try{st.likes=stLikes();}catch(e){}
    try{st.done=stDone();}catch(e){}
    try{st.names=stNames();}catch(e){}
    var o={id:g.id,day:new Date().toISOString().slice(0,10),st:st};
    try{if(window.__readRZ)o.rz=window.__readRZ;}catch(e){}
    try{if(typeof stCid==='function'){var _cid=stCid();if(_cid)o.cid=_cid;}}catch(e){}
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch(e){return '';}
}
// --- Khóa tải kiỒu stats: phút online / bình luận duy�!t / like / phá �ảo (g�"p AND) ---
// Đã �Ēng nhập: hiỒn th�9 theo SỐ SERVER (ustats theo tài khoản) cho kh�:p v�:i
// thứ server dùng �Ồ cấp vé; khách vãng lai: dùng presence chain + s� local.
let __srvVals=null;
function __pullSrvVals(cb){
  __srvVals=null;
  var tk=''; try{tk=stToken();}catch(e){}
  if(!tk){ if(cb)cb(); return; }
  fetch(apiRoot()+'/api/ustats',{headers:{'Authorization':'Bearer '+tk},cache:'no-store'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){
      if(j){
        var num=function(v){return (typeof v==='number'&&isFinite(v))?v:0;};
        __srvVals={likes:num(j.likes),done:num(j.completed)};
      }
      if(cb)cb();
    }).catch(function(){ if(cb)cb(); });
}
function __statVals(){if(__srvVals)return __srvVals;var o={likes:0,done:0};try{o.likes=stLikes();}catch(e){}try{o.done=stDone();}catch(e){}return o;}
function __statsRows(g,apprN){
  var rq=(g.gate&&g.gate.require)||{},rows=[],v=__statVals();
  var needRead=readSecsOf(g),rawRead=Math.floor(readElapsed()/1000),hasRead=Math.min(needRead,rawRead);rows.push({k:'r',need:needRead,has:hasRead,ok:readElapsed()>=needRead*1000,label:cmtT('g_readReq',"�c b�i {n} gi�y").replace('{n}',needRead),hint:'<small>'+cmtT('g_readHint',"c� m� trang l� t�nh gi�")+'</small>'});
  if(rq.likes!=null)rows.push({k:'l',need:+rq.likes,has:v.likes,ok:v.likes>=+rq.likes,label:cmtT('go_req_like',"Thích {n} game").replace('{n}',rq.likes),hint:'<a href="'+apiRoot()+'/index.html" style="color:#0066cc">'+cmtT('go_likeNow',"→ thích ngay")+'</a>'});
  if(rq.completed!=null)rows.push({k:'d',need:+rq.completed,has:v.done,ok:v.done>=+rq.completed,label:cmtT('go_req_done',"Phá đảo {n} game").replace('{n}',rq.completed),hint:'<small>'+cmtT('go_doneHint',"bấm \"Phá đảo?\" ở trang game")+'</small>'});
  if(rq.comments!=null){
    var pend=(apprN==null);
    var who='';
    try{
      if(stLogged()){who=cmtT('g_whoAcc',"theo tài khoản");}
      else{var _nm=stNames();who=_nm.length?(cmtT('g_whoNames',"theo tên: ")+_nm.map(function(x){return escHtml(x);}).join(', ')):cmtT('g_whoNone',"chưa thấy tên nào — hãy bình luận 1 cái");}
    }catch(e){}
    rows.push({k:'c',need:+rq.comments,has:pend?-1:apprN,ok:!pend&&apprN>=+rq.comments,pending:pend,label:cmtT('go_req_cmt',"Có {n} bình luận được duyệt").replace('{n}',rq.comments),hint:'<small>'+cmtT('g_cmtBelow',"bình luận bên dưới, chờ duyệt (")+who+')</small>'});
  }
  return rows;
}
function __statsPass(rows){for(var i=0;i<rows.length;i++)if(!rows[i].ok)return false;return true;}
function __statsRowsHtml(rows){
  return rows.map(function(r){
    var ic=r.pending?'⬦':(r.ok?'�S':'�S'),cls=r.pending?'':(r.ok?'ok':'bad');
    var pr=r.pending?cmtT('go_checking2',"Đang kiểm tra điều kiện..."):(r.has+'/'+r.need);
    return '<div class="lockrow '+cls+'"><span>'+ic+'</span><span>'+r.label+'</span><b>'+pr+'</b>'+(r.ok?'':(r.hint||''))+'</div>';
  }).join('');
}
// Live refresh hộp khóa trong modal: vẽ lại số liệu mỗi 2s (realtime),
// tự xin vé + sang trang tải ngay khi đủ điều kiện (vé cách nhau ≥10s). Dừng khi đóng modal.
let __lockTimer=null, __lockAppr=null, __lockTick=0;
function __lockStop(){ try{ if(__lockTimer){ clearInterval(__lockTimer); __lockTimer=null; } }catch(e){} }
function __lockHead(){
  var hardNow=false; try{hardNow=stLogged();}catch(e){}
  return '�x <b>'+cmtT('g_cond',"Ch�a � i�u ki�n")+'</b>'
    +(hardNow?'':'<br><small><a href="'+apiRoot()+'/dang-nhap.html" style="color:#0066cc">'+cmtT('li_in',"Đăng nhập")+'</a> '+cmtT('go_saveProg',"để lưu tiến độ theo tài khoản")+'</small>');
}
function __lockPaint(msg,rows,head,foot){ try{ msg.innerHTML=(head||__lockHead())+'<div style="margin-top:6px;text-align:left">'+__statsRowsHtml(rows)+'</div>'+(foot||''); }catch(e){} }
function __lockLive(gid,gm,msg,res,head,foot){
  __lockStop(); __lockTick=0; __lockLastTry=0;
  __lockTimer=setInterval(function(){
    try{
      if(!document.body.contains(msg)||document.getElementById('dlModal').classList.contains('hidden')){ __lockStop(); return; }
      __lockTick++;
      var doPaint=function(){
        var rows=__statsRows(gm,__lockAppr);
        var needCmt=rows.some(function(r){return r.k==='c';});
        var paint=function(rr){
          __lockPaint(msg,rr,head,foot);
          var now=Date.now();
          if(__statsPass(rr)&&(!READ.lastTry||now-READ.lastTry>10000)){ try{READ.lastTry=now;}catch(e){} __lockStop(); msg.textContent=cmtT('g_getting',"Đủ điều kiện! Đang lấy vé..."); __ticketAndGo(gid,res,msg,true); }
        };
        if(needCmt&&(__lockTick%3===0)){ try{stApprovedCount(function(n){__lockAppr=n;paint(__statsRows(gm,n));});}catch(e){paint(rows);} }
        else paint(rows);
      };
      // M�i ~30s ��ng b�" lại s� server (nếu �ã �Ēng nhập) r�i m�:i vẽ
      if(__lockTick%3===0){ try{__pullSrvVals(doPaint);}catch(e){doPaint();} }
      else doPaint();
    }catch(e){}
  },2000);
}
function __ticketAndGo(gid,res,msgEl,wasPassing){
  __lockStop();
  msgEl.textContent=cmtT('g_ticket',"Đang lấy vé tải...");
  var gm=(GAMES_MAP||{})[gid]||{id:gid};
  stFreshToken().then(function(_tk){
    var _hh={}; try{if(_tk)_hh={'Authorization':'Bearer '+_tk};}catch(e){}
    fetch(apiRoot()+'/api/ticket?id='+encodeURIComponent(gid)+'&res='+encodeURIComponent(res)+'&proof='+encodeURIComponent(__proof(gm)),{cache:'no-store',headers:_hh})
    .then(function(r){return r.json().then(function(j){return {st:r.status,j:j};});})
    .then(function(o){
      if(o.st===200&&o.j&&o.j.ticket){ECO.owned=true;try{ecoRender();}catch(e){}try{countDownload(gid);}catch(e2){}location.href=apiRoot()+'/go.html?ticket='+encodeURIComponent(o.j.ticket);}
      else if(o.st===402){
        var need=(o.j&&o.j.need)||ECO.cost, bal=(o.j&&typeof o.j.bal==='number')?o.j.bal:ECO.bal;
        ECO.retry=true; ECO.bal=bal;
        try{ecoRender();}catch(e){}
        var short=Math.max(0,need-bal);
        var acts='<div style="margin-top:8px;display:grid;gap:6px">'
          +'<button data-eco-comment="1" class="dl-btn" style="font-size:11px;justify-content:center">'+cmtT('g_actComment',"💬 Bình luận game này (+5 EXP khi duyệt)")+'</button>';
        if(short>5) acts+='<small style="color:#4a7a9a">'+cmtT('g_actStreak',"🔥 Giữ chuỗi điểm danh để nhận thưởng lớn")+'</small>';
        acts+='</div>';
        msgEl.innerHTML='�x <b>'+cmtT('g_cond',"Ch�a � i�u ki�n")+'</b> ('+cmtT('g_cost',"Gi� t�i:")+' '+need+' EXP). '+cmtT('g_lowexp',"Thi�u {n} EXP  i�m danh m�i ng�y � t�ch nh�").replace('{n}',short)+acts;
      }
      else if(o.st===403){
        var reason=(o.j&&o.j.reason)||'';
        var rs0=__statsRows(gm,null);var needC0=rs0.some(function(r){return r.k==='c';});var hd='�x <b>'+cmtT('g_cond',"Ch�a � i�u ki�n")+'</b>'+(reason?' (<b>'+escHtml(reason)+'</b>)':'')+'. '+cmtT('g_srv',"Server v�a ki�m tra  s� b�n d��i l� m�i nh�t:");var ft='<div style="margin-top:6px"><small>'+cmtT('g_hang',"Treo trang th�m cho � r�i b�m T�i l�i (kh�ng c�n F5).")+'</small></div>';var paint=function(rr){__lockPaint(msgEl,rr,hd,ft);};__pullSrvVals(function(){var rs=__statsRows(gm,null);var nc=rs.some(function(r){return r.k==='c';});paint(rs);if(nc){try{stApprovedCount(function(n){__lockAppr=n;paint(__statsRows(gm,n));__lockLive(gid,gm,msgEl,res,hd,ft);});}catch(e){__lockLive(gid,gm,msgEl,res,hd,ft);}}else{__lockLive(gid,gm,msgEl,res,hd,ft);}});}
      else{msgEl.textContent=cmtT('g_noTicket2',"Không lấy được vé (")+o.st+')'+((o.j&&o.j.error)?' ['+o.j.error+((o.j&&o.j.miss)?':'+o.j.miss:'')+']':'');}
    }).catch(function(){msgEl.textContent=cmtT('g_offline',"Mất mạng, thử lại sau.");});
  }).catch(function(){msgEl.textContent=cmtT('g_offline',"Mất mạng, thử lại sau.");});
}
async function renderDetail(){
  const qs=new URLSearchParams(location.search);
  let GAMES=null,id='',g=null,isPreview=false;
  if(qs.get('preview')==='1'){
    try{ g=JSON.parse(sessionStorage.getItem('game_preview')||'null'); }catch(e){ g=null; }
    if(!g||!g.name){ document.querySelector('.body-text').innerHTML='<p class="note">'+escHtml(cmtT('g_noPreview',"Không có dữ liệu xem trước. Hãy bấm nút \"Xem trước\" trong trang admin."))+'</p>'; return; }
    isPreview=true; id=g.id||'preview';
  }else{
    id=getId();
    try{const _em=document.getElementById('__GAME_DATA__');if(_em){const _g=JSON.parse(_em.textContent);if(_g&&_g.id===id){g=_g;GAMES={};GAMES[id]=_g;/* KH�NG seed GAMES_MAP bằng 1 game: loadMap(force) phải tải full danh mục, nếu không related luôn r�ng và ghi �è HTML do server render */loadMap(true).then(function(m){GAMES=m;try{Object.assign(GAMES_MAP||{},m);}catch(e){}try{if(!isPreview)renderRelatedList();}catch(e){}}).catch(function(){});}}}catch(e){}
    if(!g){GAMES=await loadMap();g=GAMES[id];}
  }
  if(!g){const nf=document.querySelector('.kawaii-d')||document.querySelector('.wrap'); if(nf)nf.innerHTML=`<div style="padding:20px;text-align:center"><h2>${cmtT('g_notfound',"Không tìm thấy game!")}</h2><p><a href="${apiRoot()}/index.html">${cmtT('back_home',"‹ Về trang chủ")}</a></p></div>`; return;}
  if(!isPreview){try{xpBump('visit',id);}catch(e){}}
  if(!isPreview){try{readStart(id,readSecsOf(g));}catch(e){}}
  document.title=g.name+cmtT('g_titleMid'," - Tải Game Java ")+g.res[0]+' | J2ME.VERCEL.APP';
  const bc2=document.getElementById('bcName'); if(bc2) bc2.textContent=g.name;
  const can=document.querySelector('link[rel="canonical"]'); if(can) can.href=location.origin+`/game/${id}.html`;
  const ogUrl=document.querySelector('meta[property="og:url"]'); if(ogUrl) ogUrl.content=location.origin+`/game/${id}.html`;
  const ogTitle=document.querySelector('meta[property="og:title"]'); if(ogTitle) ogTitle.content=g.name+' - Game Java';
  const ogImg=document.querySelector('meta[property="og:image"]'); if(ogImg&&g.thumb) ogImg.content=g.thumb;
  const metaDesc=document.querySelector('meta[name="description"]');   if(metaDesc) metaDesc.content=cmtT('g_metaA',"Tải ")+g.name+cmtT('g_metaB'," cho Java J2ME. ")+`${String(g.desc||'').replace(/\[credit\][\s\S]*?\[\/credit\]/gi,' ').slice(0,120)}`+cmtT('g_metaC'," Hỗ trợ ")+`${(g.res||[]).join(', ')}.`;
  if(!isPreview&&location.search.includes('id=')){ history.replaceState(null,'',apiRoot()+`/game/${id}.html`); }
  const bc=document.getElementById('bcName'); if(bc) bc.textContent=g.name;
  if(isPreview){document.getElementById('breadcrumb').insertAdjacentHTML('afterend','<p class="note">'+escHtml(cmtT('g_preview',"ĐANG XEM TRƯỚC — bấm Lưu trong admin để đăng thật."))+'</p>');}
  // detail-head (kèm ngày �Ēng nếu bài có lưu created_at)
  let dateStr='';
  try{ if(g.created_at){ const dd=new Date(g.created_at); if(!isNaN(dd)) dateStr=dd.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}); } }catch(e){}
  // Lượt tải thật từ api/stats (r�:t thì dùng s� tĩnh trong JSON)
  let dlCount=(typeof g.downloads==='number'&&g.downloads>0)?g.downloads:null;
  if(!isPreview){
    try{
      const sr=await fetch(apiRoot()+'/api/stats?id='+encodeURIComponent(id),{cache:'no-store'});
      if(sr.ok){const sj=await sr.json(); if(sj&&typeof sj.downloads==='number')dlCount=sj.downloads;}
    }catch(e){}
  }
  const head=document.querySelector('.detail-head');
  head.innerHTML=`<img src="${escHtml(g.thumb)}" alt="${escHtml(g.name)} thumb" width="84" height="84" decoding="async" fetchpriority="high"><div><h2>${escHtml(g.name)} ${g.hot?'<span style="background:#0066cc;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">HOT</span>':''} ${g.vi?'<span style="background:#0a9c4a;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">VI� T H�A</span>':''}</h2><table class="info-table"><tr><th>${cmtT('g_thr_genre',"Th� lo�i")}</th><td><a href="${apiRoot()}/category.html?cat=${encodeURIComponent(g.cat||'')}" style="color:#0066cc">${escHtml(g.cat)}</a></td></tr><tr><th>${cmtT('g_thr_size',"Dung l��ng")}</th><td>${escHtml(g.size)}</td></tr><tr><th>${cmtT('g_thr_res',"M�n h�nh")}</th><td>${(g.res||[]).map(r=>`<span class="res-tag">${escHtml(r)}</span>`).join(' ')}</td></tr>${dateStr?`<tr><th>${cmtT('g_thr_date',"Ng�y ng")}</th><td>${dateStr}</td></tr>`:''}${dlCount!=null?`<tr><th>${cmtT('g_thr_dl',"L��t t�i")}</th><td>${Number(dlCount).toLocaleString('vi-VN')}</td></tr>`:''}</table></div>`;
  // dl
  document.querySelector('.dl-grid').innerHTML=(g.res||[]).map(r=>`<div class="dl-option"><b>${escHtml(r)}</b><br><small style="color:#4a7a9a;font-size:10px">${escHtml(g.size)} ⬢ ${String(r).includes('240')?'QVGA':'QCIF'}</small><br><a href="${escHtml(apiRoot()+'/api/dl?id='+encodeURIComponent(g.id)+'&res='+encodeURIComponent(r))}" class="dl-btn" data-dl-btn="1" data-name="${escHtml(g.name)}" data-res="${escHtml(r)}">${cmtT('dl'," T�i JAR")}</a></div>`).join('');
  try{var __rbox=document.querySelector('.dl-grid');if(__rbox){var __rn=document.getElementById('readNote');if(!__rn){__rn=document.createElement('div');__rn.id='readNote';__rn.className='note';__rn.style.marginTop='8px';__rbox.after(__rn);}__rn.innerHTML=cmtT('g_readNote',"Mở trang {n}s để mở khóa tải").replace('{n}',readSecsOf(g));}}catch(e){}
  // Chia sẻ + QR + yêu thích
  try{
    const pageUrl=isPreview?location.href:('https://J2ME.VERCEL.APP/game/'+id+'.html');
    let shareBox=document.getElementById('shareBox');
    if(!shareBox){const de=document.querySelector('.kawaii-e'); if(de){shareBox=document.createElement('div');shareBox.id='shareBox';shareBox.className='kawaii-f';de.after(shareBox);}}
    if(shareBox){
      const favOn=favHas(id);
      shareBox.innerHTML=`<div class="kawaii-title">${cmtT('g_share',"Chia sẻ")}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">`
      +`<a href="https://zalo.me/share?url=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener" class="dl-btn" style="font-size:11px">Zalo</a>`
      +`<a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener" class="dl-btn" style="font-size:11px">Facebook</a>`
      +`<button id="copyLinkBtn" class="dl-btn" style="font-size:11px">${cmtT('g_copy',"Copy link")}</button>`
      +`<button id="qrBtn" class="dl-btn" style="font-size:11px">${cmtT('g_qr',"QR")}</button>`
      +`<button id="favBtn" class="dl-btn" style="font-size:11px">${favOn?cmtT('g_favOn',"♥ Đã thích"):cmtT('g_favOff',"♡ Thích")}</button>`
      +`<button id="doneBtn" class="dl-btn" style="font-size:11px">${(function(){try{return JSON.parse(localStorage.getItem('j2me_done')||'[]').indexOf(id)>=0;}catch(e){return false;}})()?cmtT('g_doneOn',"✓ Đã phá đảo"):cmtT('g_doneOff',"Phá đảo?")}</button></div>`
      +`<div id="qrWrap" style="display:none;text-align:center;margin-top:8px"><img id="qrImg" alt="QR m�x trên �i�!n thoại" width="160" height="160" style="width:160px;height:160px;border:2px solid #b8d8f8;border-radius:12px;background:#fff"><br><small style="color:#4a7a9a;font-size:10px">${cmtT('g_qrNote',"Qu�t � m� tr�n i�n tho�i")}</small></div>`;
      document.getElementById('copyLinkBtn').onclick=function(){copyPageUrl(pageUrl,this);};
      document.getElementById('qrBtn').onclick=function(){const w=document.getElementById('qrWrap');const im=document.getElementById('qrImg');if(w.style.display==='none'){if(!im.src)im.src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(pageUrl);w.style.display='block';}else{w.style.display='none';}};
      document.getElementById('favBtn').onclick=function(){const on=favToggle(id);this.textContent=favHas(id)?cmtT('g_favOn',"♥ Đã thích"):cmtT('g_favOff',"♡ Thích");if(on){xpBump('fav');}};
      document.getElementById('doneBtn').onclick=function(){try{let a=JSON.parse(localStorage.getItem('j2me_done')||'[]');const has=a.indexOf(id)>=0;a=has?a.filter(function(x){return x!==id;}):a.concat([id]);localStorage.setItem('j2me_done',JSON.stringify(a.slice(0,500)));this.textContent=has?cmtT('g_doneOff',"Phá đảo?"):cmtT('g_doneOn',"✓ Đã phá đảo");try{stEvent(has?'uncomplete':'complete',id);}catch(e){}}catch(e){}};
    }
  }catch(e){}
  // body � l��:i demo t� c�n theo s� l��ng �nh: 1 �nh cn gi�a kh�" l�:n, 2 �nh chia ��i,
  // từ 3 ảnh tr�x lên 3 ảnh/hàng, hàng cu�i lẻ tự cĒn giữa (flex + justify-content:center)
  const shots=(g.shots||[]);
  const shotCls=shots.length===1?' count-1':shots.length===2?' count-2':'';
  const shotsHtml=shots.length?`<div class="shot-grid${shotCls}">${shots.map((s,i)=>`<img src="${escHtml(s)}" alt="${cmtT('g_shotAlt',"Ảnh demo ")}${i+1}" width="240" height="320" loading="lazy" decoding="async" data-idx="${i}" class="shot-img" style="cursor:pointer">`).join('')}</div>`:`<p class="note">${cmtT('g_noShots',"Chưa có ảnh demo cho game này.")}</p>`;
  document.querySelector('.body-text').innerHTML=`<h3>${cmtT('g_intro',"=� Gi�i thi�u")}</h3><div style="white-space:pre-line">${renderDesc(g.desc||'')}</div><h3>${cmtT('g_shots',"=� H�nh �nh")}</h3>${shotsHtml}<h3>${cmtT('g_req',"� Y�u c�u")}</h3><p style="font-size:13px">⬢ <b>MIDP 2.0</b> ⬢ ${cmtT('g_thr_res',"M�n h�nh")} <b>${escHtml((g.res||[]).join(', '))}</b> ⬢ Tr�ng �0�<b>${escHtml(g.size)}</b> ⬢ Opera Mini</p>`;
  CURRENT_SHOTS=shots;
  document.querySelectorAll('.shot-img').forEach(img=>{
    img.addEventListener('click',()=>openLightbox(parseInt(img.dataset.idx,10)));
  });
  // related: cùng chuyên mục trư�:c, thiếu m�:i bù game khác (ẩn khi xem trư�:c).
  // Nếu full danh mục chưa tải xong thì GIỮ NGUY�`N HTML do server render, không ghi �è r�ng.
  function renderRelatedList(){
  const allGames=Object.values(GAMES||{}).filter(x=>x&&x.id!==g.id);
  if(!allGames.length) return;
  const sameCat=allGames.filter(x=>x.cat&&g.cat&&x.cat===g.cat);
  const restCat=allGames.filter(x=>!(x.cat&&g.cat&&x.cat===g.cat));
  const rel=sameCat.concat(restCat).slice(0,6);
  if(!rel.length) return;
  document.getElementById('relatedBox').style.display='block';
  document.getElementById('relatedGrid').innerHTML=rel.map(x=>`<a href="${apiRoot()}/game/${escHtml(x.id)}.html" style="background:#fff;border:1.5px solid #b8d8f8;border-radius:10px;padding:6px;text-align:center;text-decoration:none"><img src="${escHtml(x.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${escHtml(x.name)}" style="width:48px;height:48px;border-radius:8px;margin:0 auto;object-fit:cover"><span style="font-size:10px;font-weight:700;display:block;color:#1a3a5c">${escHtml(String(x.name||'').split('[')[0].slice(0,14))}</span><small style="font-size:9px;color:#4a7a9a">${escHtml((x.res||[])[0]||'')}</small></a>`).join('');
  }
  if(!isPreview){try{renderRelatedList();}catch(e){}}
  if(!isPreview){ try{loadComments(id);}catch(e){} }
}
// Dùng chung 1 AudioContext (singleton) thay vì tạo m�:i m�i lần -> tránh treo trình duy�!t do vượt gi�:i hạn AudioContext
let SHARED_AC=null;
function getAC(){
  try{
    if(!SHARED_AC) SHARED_AC=new (window.AudioContext||window.webkitAudioContext)();
    if(SHARED_AC.state==='suspended') SHARED_AC.resume().catch(()=>{});
    return SHARED_AC;
  }catch(e){ return null; }
}
function playClick(f=880,d=0.12,v=0.22){try{const c=getAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+d);o.stop(c.currentTime+d)}catch(e){}}
function playGlitch(){try{const c=getAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='square';o.frequency.value=120+Math.random()*300;f.type='bandpass';f.frequency.value=900;f.Q.value=8;g.gain.value=0.12;o.connect(f);f.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.18);o.stop(c.currentTime+0.18)}catch(e){}}
const ANIME_POOL=['/assets/anime-girl.png','/assets/anime-1.png','/assets/anime-2.png','/assets/anime-3.png','/assets/anime-4.png','/assets/anime-5.png','/assets/anime-6.png','/assets/anime-7.png','/assets/anime-8.png'];
let pending={href:'#',name:'',res:''};
function doDownload(name,res){
  playClick(); const gid=getId(); const gm=(GAMES_MAP||{})[gid];
  try{ ecoLoad(ecoCost(gm||{}),gid||''); }catch(e){}
  const hasRes=!!(gm&&Array.isArray(gm.res)&&gm.res.indexOf(res)>=0);
  const gt=gm&&gm.gate&&gm.gate.type;
  const mc0=document.getElementById('modalConfirm');
  const msg=document.getElementById('modalMsg');
  if(!hasRes){pending={href:'#',gid:'',name:name,res:res};if(mc0)mc0.style.display='none';msg.textContent=cmtT('g_modalDemo',"⚠ Link demo - vào admin.php nhập link thật nhé!");document.getElementById('dlModal').classList.remove('hidden');document.body.style.overflow='hidden';return false;}
  // Bài bắt �Ēng nhập (type login hoặc cờ login): chưa login thì chặn ngay �x modal
  var needLogin=!!(gm&&gm.gate&&(gt==='login'||gm.gate.login));
  var loggedNow=false; try{loggedNow=stLogged();}catch(e){}
  if(needLogin&&!loggedNow){
    pending={href:'#',gid:gid,name:name,res:res};
    if(mc0)mc0.style.display='none';
    msg.innerHTML=cmtT('g_memOnly',"🔒 Bài này <b>chỉ dành cho thành viên</b>")+'<br><a href="'+apiRoot()+'/dang-nhap.html" style="color:#0066cc;font-weight:700">'+cmtT('g_loginNow',"→ Đăng nhập ngay")+'</a><br><small style="color:#4a7a9a">'+cmtT('g_lockNote',"1 tài khoản, mở khóa theo đúng cày của bạn (chống ké máy)")+'</small>';
    document.getElementById('dlModal').classList.remove('hidden');document.body.style.overflow='hidden';return false;
  }
  // Mọi link tải �ều �i qua go.html bằng vé server (ch�ng soi source/crack link)
  if(gt==='stats'){
    pending={href:'#',gid:gid,name:name,res:res};
    __lockAppr=null;
    if(mc0)mc0.style.display='none';
    msg.textContent=cmtT('go_checking2',"Đang kiểm tra điều kiện...");
    document.getElementById('dlModal').classList.remove('hidden');document.body.style.overflow='hidden';
    var rows0=__statsRows(gm,null);
    var needCmt=rows0.some(function(r){return r.k==='c';});
    var show=function(rows){
      if(__statsPass(rows)){msg.textContent=cmtT('g_getting',"Đủ điều kiện! Đang lấy vé...");__ticketAndGo(gid,res,msg);}
      else{__lockPaint(msg,rows);}
      __lockLive(gid,gm,msg,res);
    };
    var runShow=function(){
      if(needCmt){try{stApprovedCount(function(n){__lockAppr=n;show(__statsRows(gm,n));});}catch(e){show(__statsRows(gm,null));}}
      else show(__statsRows(gm,null));
    };
    // Vẽ khung ngay bằng s� local, r�i ��ng b�" s� server (nếu �ã �Ēng nhập) �Ồ kh�:p vé
    msg.innerHTML='<div style="text-align:left">'+__statsRowsHtml(rows0)+'</div>';
    try{__pullSrvVals(runShow);}catch(e){runShow();}
    return false;
  }
  const lock=gm?__gate(gm):null;
  if(lock){
    pending={href:'#',gid:gid,name:name,res:res};
    msg.innerHTML=cmtT('g_locked',"🔒 Game bị khóa: ")+'<b>'+lock.label+'</b><br><small style="color:#4a7a9a">'+lock.need+'</small><br><a href="'+apiRoot()+'/profile.html" style="color:#0066cc;font-weight:700">'+cmtT('g_seeProfile',"→ Xem hồ sơ cày XP")+'</a>';
    if(mc0)mc0.style.display='none';
    document.getElementById('dlModal').classList.remove('hidden'); document.body.style.overflow='hidden'; return false;
  }
  pending={href:'#',gid:gid,name:name,res:res}; if(mc0)mc0.style.display=''; msg.textContent=cmtT('g_confirmA',"Bạn sắp tải ")+name+' ('+res+')'+cmtT('g_confirmB'," — bấm xác nhận để sang trang tải an toàn");
  const img=document.querySelector('.modal-anime-img'); if(img){const ch=ANIME_POOL[Math.floor(Math.random()*ANIME_POOL.length)]; img.style.display='block'; img.src=apiRoot()+ch;}
  const banner=document.querySelector('.modal-banner img'); if(banner){try{banner.src=(window.pickRandomBanner?window.pickRandomBanner():window.__BANNER_FALLBACK[Math.floor(Math.random()*window.__BANNER_FALLBACK.length)]);}catch(e){} if(window.getBannerList)window.getBannerList().then(function(list){try{banner.src=window.pickRandomBanner(list);}catch(e){}}).catch(function(){});}
  document.getElementById('modalConfirm').href='#'; document.getElementById('dlModal').classList.remove('hidden'); document.body.style.overflow='hidden'; return false;
}
// Ví EXP trong modal tải: s� dư / giá / s�x hữu / �iỒm danh (realtime, không reload)
let ECO={bal:0,checked:false,streak:0,owned:false,cost:0,ready:false,retry:false};
function ecoCost(gm){var v=parseInt(gm&&(gm.dl_cost),10);return (typeof v==='number'&&isFinite(v))?Math.max(0,Math.min(100000,v)):10;}
function ecoAuth(){var h={};try{if(stToken())h={'Authorization':'Bearer '+stToken()};}catch(e){}var cid='';try{if(typeof stCid==='function')cid=stCid()||'';}catch(e){}return {h:h,cid:cid};}
function ecoRender(){
  var box=document.getElementById('ecoBox'); if(!box) return;
  var h='<div style="background:#fffbe6;border:1.5px dashed #e6a800;border-radius:10px;padding:7px 10px;font-size:11px;line-height:1.7;margin-top:8px">�a� <b>'+ECO.bal+'</b> EXP';
  if(ECO.owned) h+=' ⬢ '+cmtT('g_owned',"� s� h�u  t�i l�i mi�n ph�");
  else if(ECO.cost>0) h+=' ⬢ '+cmtT('g_cost',"Gi� t�i:")+' <b>'+ECO.cost+'</b> EXP';
  else h+=' ⬢ '+cmtT('g_dlFree',"T�i mi�n ph�");
  if(ECO.streak>1) h+='<br><small>'+cmtT('g_streak',"🔥 Chuỗi {n} ngày").replace('{n}',ECO.streak)+'</small>';
  h+='<br>';
  if(ECO.checked) h+='<small>'+cmtT('g_checked',"Đã điểm danh hôm nay ✓")+'</small>';
  else h+='<button id="ecoCheckBtn" class="dl-btn" style="font-size:11px;padding:6px 14px">'+cmtT('g_checkin',"🎲 Điểm danh hôm nay")+'</button>';
  h+='</div>';
  box.innerHTML=h;
  var b=document.getElementById('ecoCheckBtn'); if(b) b.onclick=function(){ecoCheckin();};
}
function ecoEnsureBox(){
  var box=document.getElementById('ecoBox');
  if(!box){
    var msg=document.getElementById('modalMsg');
    if(!msg) return null;
    box=document.createElement('div'); box.id='ecoBox';
    msg.after(box);
    box=document.getElementById('ecoBox');
  }
  return box;
}
function ecoLoad(cost,gid){
  ECO.cost=cost; ECO.ready=false; ECO.retry=false;
  try{ if(!ecoEnsureBox()) return; }catch(e){ return; }
  ecoRender();
  var a=ecoAuth();
  stFreshToken().then(function(_tk){
    var hh={}; try{for(var k in a.h)hh[k]=a.h[k];}catch(e){}
    try{if(_tk)hh['Authorization']='Bearer '+_tk;}catch(e){}
    fetch(apiRoot()+'/api/economy?cid='+encodeURIComponent(a.cid),{headers:hh,cache:'no-store'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){
      if(!j) return;
      ECO.bal=+(j.bal||0); ECO.checked=!!j.checked; ECO.streak=+(j.streak||0);
      ECO.owned=!!(j.owned&&j.owned.indexOf(gid)>=0); ECO.ready=true;
      ecoRender();
    }).catch(function(){});
  }).catch(function(){});
}
function ecoCheckin(){
  var b=document.getElementById('ecoCheckBtn'); if(b){b.disabled=true;b.textContent='⬦';}
  var a=ecoAuth();
  var hh={'Content-Type':'application/json'};
  try{var _tk00=stToken();if(_tk00)hh['Authorization']='Bearer '+_tk00;}catch(e){}
  stFreshToken().then(function(_tk){
    try{if(_tk)hh['Authorization']='Bearer '+_tk;}catch(e){}
    fetch(apiRoot()+'/api/economy',{method:'POST',headers:hh,body:JSON.stringify({op:'checkin',cid:a.cid,sbt:(function(){try{return stToken();}catch(e){return '';}})()})})
    .then(function(r){return r.json().then(function(j){return {st:r.status,j:j};});})
    .then(function(o){
      var j=o.j||{};
      if(j&&typeof j.bal==='number'){ECO.bal=j.bal;}
      if(j&&(j.ok||j.reason==='done')){ECO.checked=true;ECO.streak=+(j.streak||ECO.streak);}
      ECO.ready=true;
      ecoRender();
      if(j&&j.ok){
        var msg=document.getElementById('modalMsg');
        if(msg)msg.textContent=cmtT('g_got',"🎲 +{n} EXP!").replace('{n}',j.got||0);
        // ĐiỒm danh xong mà modal �ang kẹt thiếu EXP và giờ �ã �ủ -> tự chạy tiếp
        try{
          if(ECO.retry&&!document.getElementById('dlModal').classList.contains('hidden')&&pending&&pending.gid&&pending.res&&(ECO.owned||ECO.bal>=ECO.cost)){
            ECO.retry=false;
            __ticketAndGo(pending.gid,pending.res,document.getElementById('modalMsg'));
          }
        }catch(e){}
      }
    })
    .catch(function(){ecoRender();});
    }).catch(function(){ecoRender();});
}
// Nút tải render ��"ng dùng data-attr (không inline onclick �  tránh XSS qua tên game)
document.addEventListener('click',function(e){const b=e.target&&e.target.closest?e.target.closest('[data-dl-btn]'):null; if(!b) return; e.preventDefault(); try{doDownload(b.dataset.name||'',b.dataset.res||'');}catch(err){}});
(function(){
  const modal=document.getElementById('dlModal');
  const close=()=>{
    try{ playClick(520,0.1,0.15); }catch(e){}
    try{ if(typeof __lockStop==='function') __lockStop(); }catch(e){}
    modal.classList.add('hidden');
    document.body.style.overflow='';
  };
  document.getElementById('modalClose')?.addEventListener('click',close);
  document.getElementById('modalCancel')?.addEventListener('click',close);
  modal?.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !modal.classList.contains('hidden')) close(); });
  document.querySelector('.modal-anime')?.addEventListener('mouseenter',()=>{ try{ playGlitch(); }catch(e){} });
  document.getElementById('modalConfirm')?.addEventListener('click',e=>{
    e.preventDefault();
    const p=pending;
    if(!p||!p.gid||!p.res){
      document.getElementById('modalMsg').textContent=cmtT('g_modalDemo',"⚠ Link demo - vào admin.php nhập link thật nhé!");
      setTimeout(close,1400);
      return;
    }
    try{ playClick(1040,0.14,0.25); }catch(e){}
    // Mọi link tải �ều qua go.html: xin vé server r�i chuyỒn trang (ch�ng crack/soi source)
    __ticketAndGo(p.gid,p.res,document.getElementById('modalMsg'));
  });
})();
renderDetail();
// Vẽ lại các thẻ ��"ng (chi tiết/chia sẻ/bình luận/ví) khi i18n sẵn sàng / ��"i ngôn ngữ
document.addEventListener('i18n-ready',function(){
  try{
    if(!(window.I18N&&I18N.lang&&I18N.lang()!=='vi')) return;
    if(typeof renderDetail==='function'){ renderDetail(); }
  }catch(e){}
  try{ if(document.getElementById('ecoBox')&&typeof ecoRender==='function'){ ecoRender(); } }catch(e){}
});
