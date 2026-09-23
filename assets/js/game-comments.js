// game-comments
// Bình luận + �ánh giá sao (phân trang 5/trang + realtime polling, giữ nguyên trang �ang xem)
let CMT_PAGE=1; const CMT_LIMIT=5; let CMT_GAME=''; let CMT_TOTAL=0, CMT_PAGES=1, CMT_TIMER=null, CMT_KNOWN=0;
function cmtT(k,fb){ try{ if(window.I18N&&window.I18N.t){const v=window.I18N.t(k); if(v&&v!==k) return v;} }catch(e){} return fb; }
// HiỒn th�9 rõ ngày/tháng/nĒm - giờ:phút (vd: 20/09/2026 - 14:05)
function fmtDT(iso){ try{ const dt=new Date(iso); if(isNaN(dt)) return ''; const p=function(n){return String(n).padStart(2,'0');}; return p(dt.getDate())+'/'+p(dt.getMonth()+1)+'/'+dt.getFullYear()+' - '+p(dt.getHours())+':'+p(dt.getMinutes()); }catch(e){ return ''; } }
async function loadComments(gameId, page){
  const box=document.getElementById('cmtBox'); if(!box) return;
  box.style.display='block';
  CMT_GAME=gameId; if(page) CMT_PAGE=page;
  try{ window.CMT_GAME=CMT_GAME; window.CMT_PAGE=CMT_PAGE; }catch(e){}
  try{var _cn=document.getElementById('cmtName');if(_cn&&!_cn.value){var _nm=stNames();if(_nm.length)_cn.value=_nm[_nm.length-1];}}catch(e){}
  const sum=document.getElementById('cmtSummary'), list=document.getElementById('cmtList'), msg=document.getElementById('cmtMsg');
  const pager=document.getElementById('cmtPager');
  sum.textContent=cmtT('cmt_loading',"Đang tải bình luận..."); list.innerHTML=''; msg.textContent='';
  if(pager) pager.innerHTML='';
  try{
    const r=await fetch(apiRoot()+'/api/comments?game='+encodeURIComponent(gameId)+'&page='+CMT_PAGE+'&limit='+CMT_LIMIT,{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const j=await r.json();
    CMT_TOTAL=j.total||0; CMT_PAGES=j.pages||1; CMT_PAGE=j.page||1;
    if(CMT_KNOWN===0) CMT_KNOWN=CMT_TOTAL;
    sum.innerHTML=CMT_TOTAL?('��& <b>'+escHtml(String(j.avg))+'</b> � '+CMT_TOTAL+' '+cmtT('cmt_reviews',"�nh gi�")+' � '+cmtT('cmt_page',"trang")+' '+CMT_PAGE+'/'+CMT_PAGES):cmtT('cmt_empty',"Ch�a c� �nh gi� n�o. H�y l� ng��i �u ti�n!");
    window._cmtReplyTo=null;
    const replyLbl=cmtT('cmt_reply',"↳ Trả lời");
    const itemHtml=function(c,reply){
      const st=reply?'':('<div class="stars">'+'â˜…'.repeat(c.stars)+'â˜†'.repeat(5-c.stars)+'</div>');
      return '<div class="cmt-item"'+(reply?' style="margin:6px 0 0 18px;border-style:dashed"':'')+'>'+st+'<b>'+escHtml(c.name)+'</b> <small>'+escHtml(fmtDT(c.created_at))+'</small><div>'+escHtml(c.text)+'</div>'
      +(reply?'':'<div><button data-reply="'+escHtml(c.id)+'" data-rname="'+escHtml(c.name)+'" style="background:none;border:none;color:#0066cc;font-size:11px;cursor:pointer;padding:0">'+escHtml(replyLbl)+'</button></div>')+'</div>';
    };
    list.innerHTML=(j.comments||[]).map(function(c){
      return itemHtml(c,false)+((c.replies||[]).map(function(x){return itemHtml(x,true);}).join(''));
    }).join('') || ('<p class="note">'+escHtml(cmtT('cmt_empty_page',"Trang này chưa có bình luận."))+'</p>');
    list.querySelectorAll('[data-reply]').forEach(function(b){
      b.onclick=function(){
        window._cmtReplyTo={id:b.getAttribute('data-reply'),name:b.getAttribute('data-rname')};
        let tag=document.getElementById('replyTag');
        if(!tag){tag=document.createElement('div');tag.id='replyTag';tag.style.cssText='font-size:11px;color:#0066cc';form.insertBefore(tag,form.firstChild);}
        tag.innerHTML=cmtT('cmt_replying',"Đang trả lời")+' <b></b> <a href="#" id="replyCancel" style="color:#4a7a9a">[há»§y]</a>';
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
  }catch(e){ sum.textContent=String((e&&e.message)||'').indexOf('403')>=0?cmtT('cmt_403',"Không tải được bình luận (bị chặn 403 — báo admin kiểm tra Vercel Deployment Protection)."):cmtT('cmt_err',"Không tải được bình luận lúc này."); }
  const form=document.getElementById('cmtForm');
  form.onsubmit=function(ev){
    ev.preventDefault();
    msg.textContent=cmtT('cmt_sending',"Đang gửi...");
    try{const last=+localStorage.getItem('cmt_last')||0; if(Date.now()-last<5*60*1000){msg.textContent=cmtT('cmt_fast',"Bạn gửi quá nhanh, thử lại sau vài phút.");return;}}catch(e){}
    const payload={game:gameId,name:document.getElementById('cmtName').value,stars:document.getElementById('cmtStars').value,text:document.getElementById('cmtText').value,website:document.getElementById('cmtWeb').value,sbt:''};
    if(window._cmtReplyTo&&window._cmtReplyTo.id)payload.replyTo=window._cmtReplyTo.id;
    // Refresh token trư�:c khi gửi �Ồ server nhận �úng tài khoản (lấy +5 EXP / �ếm duy�!t)
    stFreshToken().then(function(tk){ payload.sbt=tk||'';
    fetch(apiRoot()+'/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.text().then(function(t){let j={};try{j=JSON.parse(t);}catch(e){}return {st:r.status,j:j};});})
      .then(function(o){
        if(o.st===200&&o.j.ok){msg.textContent=cmtT('cmt_sent',"Đã gửi! Bình luận hiện sau khi admin duyệt.")+(o.j.xpBonus?' (+5 EXP)':(o.j.auth==='stale'?' ('+cmtT('g_relogin',"Phiên hết hạn — đăng nhập lại để nhận EXP")+')':(o.j.xpReason==='no_uid'?' ('+cmtT('g_loginBonus',"Đăng nhập để nhận +5 EXP khi bình luận")+')':'')));document.getElementById('cmtText').value='';window._cmtReplyTo=null;const tg=document.getElementById('replyTag');if(tg)tg.remove();try{localStorage.setItem('cmt_last',String(Date.now()));}catch(e){}try{xpBump('comment');}catch(e){}try{stSaveName(document.getElementById('cmtName').value);}catch(e){}try{_stApprCache={at:0,n:-1};}catch(e){}try{if(o.j.xpBonus)ECO.bal+=5;}catch(e){}}
        else if(o.st===503){msg.textContent=cmtT('cmt_nohost',"Chức năng bình luận chưa được bật trên hosting này.");}
        else if(o.st===429){msg.textContent=cmtT('cmt_fast',"Bạn gửi quá nhanh, thử lại sau vài phút.");}
        else if(o.st===403){msg.textContent=cmtT('cmt_403post',"Bị chặn (403): tải lại trang rồi gửi lại. Nếu vẫn lỗi, báo admin kiểm tra Vercel Deployment Protection / Firewall.");}
        else{var _e=(o.j&&o.j.error)||'';if(_e==='cross-origin denied')_e=cmtT('cmt_cross',"bị chặn cross-origin, tải lại trang rồi thử lại");if(_e==='duplicate comment')_e=cmtT('g_dupCmt',"Bạn vừa gửi bình luận này rồi, thử lại sau nhé");msg.textContent=cmtT('cmt_errPre',"Lỗi: ")+(_e||cmtT('cmt_code',"mã {s}, thử lại sau").replace('{s}',o.st));}
      })
      .catch(function(){msg.textContent=cmtT('cmt_neterr',"Không gửi được. Kiểm tra mạng rồi thử lại.");});
    }).catch(function(){msg.textContent=cmtT('cmt_neterr',"Không gửi được. Kiểm tra mạng rồi thử lại.");});
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
