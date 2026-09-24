// assets/js/game-read.js - per-article reading time (thay cho phút online toàn site)
// Đếm giây khi trang visible + focused + đã scroll >30px hoặc >2s
(function(){
'use strict';
function getId(){
  try{
    var p=new URLSearchParams(location.search);
    var id=p.get('id'); if(id) return id.replace(/\.html$/,'');
    var m=location.pathname.match(/\/game\/([^\/]+)\.html$/); if(m) return decodeURIComponent(m[1]);
    var m2=location.pathname.match(/\/game\/([^\/]+)$/); if(m2) return decodeURIComponent(m2[1]);
  }catch(e){}
  return '';
}
function key(id){return 'j2me_read_'+String(id||getId()).slice(0,120);}
window.stReadKey=key;
// Mỗi lần mở trang phải đếm lại từ 0 - không cache
try{var _rk=key(); sessionStorage.setItem(_rk,'0'); localStorage.removeItem(_rk);}catch(e){}
window.stRead=function(id){try{var k=key(id||getId());var s=sessionStorage.getItem(k); if(s!=null) return Math.max(0, parseInt(s,10)||0); return 0;}catch(e){return 0;}};
function tick(){
  try{
    if(document.hidden||!document.hasFocus()) return;
    var gid=getId(); if(!gid) return;
    var k=key(gid);
    var cur=Math.max(0, parseInt(sessionStorage.getItem(k)||'0',10)||0);
    if(cur<2 || window.scrollY>30 || document.documentElement.scrollTop>30){
      var nv=cur+1;
      try{sessionStorage.setItem(k,String(nv));}catch(e){}
    }
  }catch(e){}
}
try{setInterval(tick,1000);}catch(e){}
})();
