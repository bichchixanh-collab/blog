// game-comments
// BÃ¬nh luáº­n + Ä‘Ã¡nh giÃ¡ sao (phÃ¢n trang 5/trang + realtime polling, giá»¯ nguyÃªn trang Ä‘ang xem)
let CMT_PAGE=1; const CMT_LIMIT=5; let CMT_GAME=''; let CMT_TOTAL=0, CMT_PAGES=1, CMT_TIMER=null, CMT_KNOWN=0;
function cmtT(k,fb){ try{ if(window.I18N&&window.I18N.t){const v=window.I18N.t(k); if(v&&v!==k) return v;} }catch(e){} return fb; }
// Hiá»ƒn thá»‹ rÃµ ngÃ y/thÃ¡ng/nÄƒm - giá»:phÃºt (vd: 20/09/2026 - 14:05)
function fmtDT(iso){ try{ const dt=new Date(iso); if(isNaN(dt)) return ''; const p=function(n){return String(n).padStart(2,'0');}; return p(dt.getDate())+'/'+p(dt.getMonth()+1)+'/'+dt.getFullYear()+' - '+p(dt.getHours())+':'+p(dt.getMinutes()); }catch(e){ return ''; } }
async function loadComments(gameId, page){
  const box=document.getElementById('cmtBox'); if(!box) return;
  box.style.display='block';
  CMT_GAME=gameId; if(page) CMT_PAGE=page;
  try{ window.CMT_GAME=CMT_GAME; window.CMT_PAGE=CMT_PAGE; }catch(e){}
  try{var _cn=document.getElementById('cmtName');if(_cn&&!_cn.value){var _nm=stNames();if(_nm.length)_cn.value=_nm[_nm.length-1];}}catch(e){}
  const sum=document.getElementById('cmtSummary'), list=document.getElementById('cmtList'), msg=document.getElementById('cmtMsg');
  const pager=document.getElementById('cmtPager');
  sum.textContent=cmtT('cmt_loading','Äang táº£i bÃ¬nh luáº­n...'); list.innerHTML=''; msg.textContent='';
  if(pager) pager.innerHTML='';
  try{
    const r=await fetch(apiRoot()+'/api/comments?game='+encodeURIComponent(gameId)+'&page='+CMT_PAGE+'&limit='+CMT_LIMIT,{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const j=await r.json();
    CMT_TOTAL=j.total||0; CMT_PAGES=j.pages||1; CMT_PAGE=j.page||1;
    if(CMT_KNOWN===0) CMT_KNOWN=CMT_TOTAL;
    sum.innerHTML=CMT_TOTAL?('â˜… <b>'+escHtml(String(j.avg))+'</b> â€” '+CMT_TOTAL+' '+cmtT('cmt_reviews','Ä‘Ã¡nh giÃ¡')+' â€” '+cmtT('cmt_page','trang')+' '+CMT_PAGE+'/'+CMT_PAGES):cmtT('cmt_empty','ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡ nÃ o. HÃ£y lÃ  ngÆ°á»i Ä‘áº§u tiÃªn!');
    window._cmtReplyTo=null;
    const replyLbl=cmtT('cmt_reply','â†³ Tráº£ lá»i');
    const itemHtml=function(c,reply){
      const st=reply?'':('<div class="stars">'+'â˜…'.repeat(c.stars)+'â˜†'.repeat(5-c.stars)+'</div>');
      return '<div class="cmt-item"'+(reply?' style="margin:6px 0 0 18px;border-style:dashed"':'')+'>'+st+'<b>'+escHtml(c.name)+'</b> <small>'+escHtml(fmtDT(c.created_at))+'</small><div>'+escHtml(c.text)+'</div>'
      +(reply?'':'<div><button data-reply="'+escHtml(c.id)+'" data-rname="'+escHtml(c.name)+'" style="background:none;border:none;color:#0066cc;font-size:11px;cursor:pointer;padding:0">'+escHtml(replyLbl)+'</button></div>')+'</div>';
    };
    list.innerHTML=(j.comments||[]).map(function(c){
      return itemHtml(c,false)+((c.replies||[]).map(function(x){return itemHtml(x,true);}).join(''));
    }).join('') || ('<p class="note">'+escHtml(cmtT('cmt_empty_page','Trang nÃ y chÆ°a cÃ³ bÃ¬nh luáº­n.'))+'</p>');
    list.querySelectorAll('[data-reply]').forEach(function(b){
      b.onclick=function(){
        window._cmtReplyTo={id:b.getAttribute('data-reply'),name:b.getAttribute('data-rname')};
        let tag=document.getElementById('replyTag');
        if(!tag){tag=document.createElement('div');tag.id='replyTag';tag.style.cssText='font-size:11px;color:#0066cc';form.insertBefore(tag,form.firstChild);}
        tag.innerHTML=cmtT('cmt_replying','Äang tráº£ lá»i')+' <b></b> <a href="#" id="replyCancel" style="color:#4a7a9a">[há»§y]</a>';
        tag.querySelector('b').textContent=window._cmtReplyTo.name;
        tag.querySelector('#replyCancel').onclick=function(e){e.preventDefault();window._cmtReplyTo=null;tag.remove();};
        document.getElementById('cmtText').focus();
      };
    });
    if(pager&&CMT_PAGES>1){
      const btn=function(label,pg,dis){return '<button data-pg="'+pg+'" '+(dis?'disabled':'')+' style="background:'+(String(pg)===String(CMT_PAGE)?'#0066cc':'#fff')+';color:'+(String(pg)===String(CMT_PAGE)?'#fff':'#0066cc')+';border:1.5px solid #81c7f0;border-radius:14px;padding:4px 10px;font-size:11px;font-weight:700;cursor:'+(dis?'default':'pointer')+';opacity:'+(dis?'.5':'1')+'">'+label+'</button>';};
      let h=btn('Â«',CMT_PAGE-1,CMT_PAGE<=1);
      for(let p=1;p<=CMT_PAGES;p++){ if(CMT_PAGES>7&&Math.abs(p-CMT_PAGE)>2&&(p!==1&&p!==CMT_PAGES)) continue; h+=btn(String(p),p,false); }
      h+=btn('Â»',CMT_PAGE+1,CMT_PAGE>=CMT_PAGES);
      pager.innerHTML=h;
      pager.querySelectorAll('[data-pg]').forEach(function(b){ b.onclick=function(){ const pg=parseInt(b.getAttribute('data-pg'),10); if(pg>=1&&pg<=CMT_PAGES&&pg!==CMT_PAGE){ CMT_PAGE=pg; try{window.CMT_PAGE=pg;}catch(e){} loadComments(CMT_GAME,pg); } }; });
    }
    const hint=document.getElementById('cmtNewHint'); if(hint) hint.style.display='none';
    startCmtPolling();
  }catch(e){ sum.textContent=String((e&&e.message)||'').indexOf('403')>=0?cmtT('cmt_403','KhÃ´ng táº£i Ä‘Æ°á»£c bÃ¬nh luáº­n (bá»‹ cháº·n 403).'):cmtT('cmt_err','KhÃ´ng táº£i Ä‘Æ°á»£c bÃ¬nh luáº­n lÃºc nÃ y.'); }
  const form=document.getElementById('cmtForm');
  form.onsubmit=function(ev){
    ev.preventDefault();
    msg.textContent=cmtT('cmt_sending','Äang gá»­i...');
    try{const last=+localStorage.getItem('cmt_last')||0; if(Date.now()-last<5*60*1000){msg.textContent=cmtT('cmt_fast','Báº¡n gá»­i quÃ¡ nhanh, thá»­ láº¡i sau vÃ i phÃºt.');return;}}catch(e){}
    const payload={game:gameId,name:document.getElementById('cmtName').value,stars:document.getElementById('cmtStars').value,text:document.getElementById('cmtText').value,website:document.getElementById('cmtWeb').value,sbt:''};
    if(window._cmtReplyTo&&window._cmtReplyTo.id)payload.replyTo=window._cmtReplyTo.id;
    // Refresh token trÆ°á»›c khi gá»­i Ä‘á»ƒ server nháº­n Ä‘Ãºng tÃ i khoáº£n (láº¥y +5 EXP / Ä‘áº¿m duyá»‡t)
    stFreshToken().then(function(tk){ payload.sbt=tk||'';
    fetch(apiRoot()+'/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.text().then(function(t){let j={};try{j=JSON.parse(t);}catch(e){}return {st:r.status,j:j};});})
      .then(function(o){
        if(o.st===200&&o.j.ok){msg.textContent=cmtT('cmt_sent','ÄÃ£ gá»­i! BÃ¬nh luáº­n hiá»‡n sau khi admin duyá»‡t.')+(o.j.xpBonus?' (+5 EXP)':(o.j.auth==='stale'?' ('+cmtT('g_relogin','PhiÃªn háº¿t háº¡n â€” Ä‘Äƒng nháº­p láº¡i Ä‘á»ƒ nháº­n EXP')+')':(o.j.xpReason==='no_uid'?' ('+cmtT('g_loginBonus','ÄÄƒng nháº­p Ä‘á»ƒ nháº­n +5 EXP khi bÃ¬nh luáº­n')+')':'')));document.getElementById('cmtText').value='';window._cmtReplyTo=null;const tg=document.getElementById('replyTag');if(tg)tg.remove();try{localStorage.setItem('cmt_last',String(Date.now()));}catch(e){}try{xpBump('comment');}catch(e){}try{stSaveName(document.getElementById('cmtName').value);}catch(e){}try{_stApprCache={at:0,n:-1};}catch(e){}try{if(o.j.xpBonus)ECO.bal+=5;}catch(e){}}
        else if(o.st===503){msg.textContent=cmtT('cmt_nohost','Chá»©c nÄƒng bÃ¬nh luáº­n chÆ°a Ä‘Æ°á»£c báº­t trÃªn hosting nÃ y.');}
        else if(o.st===429){msg.textContent=cmtT('cmt_fast','Báº¡n gá»­i quÃ¡ nhanh, thá»­ láº¡i sau vÃ i phÃºt.');}
        else if(o.st===403){msg.textContent=cmtT('cmt_403post','Bá»‹ cháº·n (403): táº£i láº¡i trang rá»“i gá»­i láº¡i.');}
        else{var _e=(o.j&&o.j.error)||'';if(_e==='cross-origin denied')_e=cmtT('cmt_cross','bá»‹ cháº·n cross-origin, táº£i láº¡i trang rá»“i thá»­ láº¡i');if(_e==='duplicate comment')_e=cmtT('g_dupCmt','Báº¡n vá»«a gá»­i bÃ¬nh luáº­n nÃ y rá»“i, thá»­ láº¡i sau nhÃ©');msg.textContent=cmtT('cmt_errPre','Lá»—i: ')+(_e||cmtT('cmt_code','mÃ£ {s}, thá»­ láº¡i sau').replace('{s}',o.st));}
      })
      .catch(function(){msg.textContent=cmtT('cmt_neterr','KhÃ´ng gá»­i Ä‘Æ°á»£c. Kiá»ƒm tra máº¡ng rá»“i thá»­ láº¡i.');});
    }).catch(function(){msg.textContent=cmtT('cmt_neterr','KhÃ´ng gá»­i Ä‘Æ°á»£c. Kiá»ƒm tra máº¡ng rá»“i thá»­ láº¡i.');});
  };
}
function startCmtPolling(){
  try{ if(CMT_TIMER) clearInterval(CMT_TIMER); }catch(e){}
  CMT_TIMER=setInterval(async function(){
    try{
      if(document.hidden||!CMT_GAME) return;
      const r=await fetch(apiRoot()+'/api/comments?game='+encodeURIComponent(CMT_GAME)+'&page=1&limit=1',{cache:'no-store'});
      if(!r.ok) return;
      const j=await r.json();
      if(typeof j.total==='number'&&j.total!==CMT_KNOWN){
        if(CMT_PAGE===1){ CMT_KNOWN=j.total; loadComments(CMT_GAME,1); }
        else{ const h=document.getElementById('cmtNewHint'); if(h) h.style.display=''; }
      }
    }catch(e){}
  },15000);
  try{ document.getElementById('cmtReloadBtn').onclick=function(){ CMT_KNOWN=0; CMT_PAGE=1; loadComments(CMT_GAME,1); }; }catch(e){}
}
