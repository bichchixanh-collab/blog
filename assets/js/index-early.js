if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});}

try{if(localStorage.getItem('j2me_lite')==='1')document.documentElement.classList.add('lite');}catch(e){}