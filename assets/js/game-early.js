try{if(localStorage.getItem('j2me_lite')==='1')document.documentElement.classList.add('lite');}catch(e){}

(function(){try{var p=location.pathname||'/';var gi=p.indexOf('/game/');var r=gi>=0?p.slice(0,gi).replace(/\/$/,''):(p.length>1&&p.charAt(p.length-1)==='/'?p.slice(0,-1):p.slice(0,Math.max(0,p.lastIndexOf('/'))));var m=document.getElementById('pwaManifest');if(m)m.href=r+'/manifest.webmanifest';if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register(r+'/sw.js').catch(function(){});});}}catch(e){}})();

// Fix sớm link/img/script[data-root-*] TRƯỚC khi game-core.js chạy (tránh 404 CSS trên XAMPP subpath /blog/blog-v3/game/*.html)
function gameRoot(){try{var p=location.pathname||'/';var gi=p.indexOf('/game/');if(gi>=0)return p.slice(0,gi).replace(/\/$/,'');if(p.length>1&&p.charAt(p.length-1)==='/')return p.slice(0,-1);return p.slice(0,Math.max(0,p.lastIndexOf('/')));}catch(e){return '';}}
(function(){try{var r=gameRoot();function fix(){try{document.querySelectorAll('link[data-root-href]').forEach(function(l){var want=(r?r:'')+'/'+l.getAttribute('data-root-href');if(l.getAttribute('href')!==want)l.setAttribute('href',want);});document.querySelectorAll('img[data-root-src]').forEach(function(im){var want=(r?r:'')+'/'+im.getAttribute('data-root-src');if(im.getAttribute('src')!==want)im.setAttribute('src',want);});document.querySelectorAll('a[data-root-link]').forEach(function(a){var want=(r?r:'')+'/'+a.getAttribute('data-root-link');if(a.getAttribute('href')!==want)a.setAttribute('href',want);});}catch(e){}}fix();try{document.addEventListener('DOMContentLoaded',fix);}catch(e){}}catch(e){}})();

(function(){try{var r=gameRoot();document.write('<script src="'+(r?r:'')+'/assets/i18n.min.js?v=11"><\/script><script src="'+(r?r:'')+'/assets/js/sb-config.js"><\/script><script src="'+(r?r:'')+'/assets/js/sb-auth.js"><\/script>');}catch(e){}})();

